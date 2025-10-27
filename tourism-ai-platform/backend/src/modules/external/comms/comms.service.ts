import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { WhatsAppService } from './whatsapp.service';
import { NluPipeline, DetectedIntent } from './nlu.pipeline';
import { StateStore } from './state.store';
import { AppointmentsTool } from './tools/appointments.tool';
import { DocsTool } from './tools/docs.tool';
import { PaymentsTool } from './tools/payments.tool';
import { TravelTool } from './tools/travel.tool';
import { KafkaService } from '@/lib/nestjs-kafka';
import { EventBusService } from '../../../common/services/event-bus.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { RedisService } from '@/lib/nestjs-redis';
import { ConfigService } from '@nestjs/config';
import { CommunicationLogEntity } from '../../../database/entities/communication-log.entity';
import { CaseEntity } from '../../../database/entities/case.entity';
import { redactPII } from '../../../common/filters/pii-redaction.util';
import crypto from 'crypto';
import { lastValueFrom } from 'rxjs';
import { pipelineTracer } from './metrics';
import { SpanStatusCode } from '@opentelemetry/api';

interface IncomingMessageContext {
  tenantId: string;
  caseId: string;
  patientId?: string;
  providerId?: string;
  locale: string;
  from: string;
  to: string;
  messageId: string;
  text: string;
  metadata: Record<string, any>;
  raw: any;
}

interface ActionResult {
  template: string;
  params: string[];
  locale?: string;
  statePatch?: Record<string, any>;
  escalate?: boolean;
  metadata?: Record<string, any>;
}

const IDEMPOTENCY_TTL_SECONDS = 10 * 60;

@Injectable()
export class CommsService {
  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly nluPipeline: NluPipeline,
    private readonly stateStore: StateStore,
    private readonly appointmentsTool: AppointmentsTool,
    private readonly docsTool: DocsTool,
    private readonly paymentsTool: PaymentsTool,
    private readonly travelTool: TravelTool,
    private readonly kafkaService: KafkaService,
    private readonly eventBus: EventBusService,
    private readonly tenantContext: TenantContextService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    @InjectRepository(CommunicationLogEntity)
    private readonly commsRepository: Repository<CommunicationLogEntity>,
    @InjectRepository(CaseEntity)
    private readonly caseRepository: Repository<CaseEntity>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CommsService.name);
  }

  async handleWhatsappWebhook(payload: any): Promise<void> {
    const changes = this.extractIncomingMessages(payload);
    for (const context of changes) {
      try {
        const span = pipelineTracer.startSpan('conversation.handle', {
          attributes: {
            tenantId: context.tenantId,
            caseId: context.caseId,
          },
        });
        try {
          await this.processIncomingMessage(context);
          span.setStatus({ code: SpanStatusCode.OK });
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (error as Error).message,
          });
          span.recordException(error);
          throw error;
        } finally {
          span.end();
        }
      } catch (error) {
        this.logger.error(
          {
            tenantId: context.tenantId,
            caseId: context.caseId,
            messageId: context.messageId,
            error: (error as Error).message,
          },
          'Failed to process WhatsApp webhook message',
        );
      }
    }
  }

  async sendTemplateMessage(
    tenantId: string,
    idempotencyKey: string | undefined,
    payload: {
      caseId?: string;
      to: string;
      templateName: string;
      params?: string[];
      locale?: string;
      metadata?: Record<string, any>;
    },
  ) {
    if (!idempotencyKey) {
      throw new UnauthorizedException('Missing X-Idempotency-Key header');
    }
    const acquired = await this.acquireIdempotency(idempotencyKey);
    if (!acquired) {
      const existing = await this.commsRepository.findOne({
        where: {
          tenantId,
          metadata: {
            idempotencyKey,
          } as any,
        },
        order: { createdAt: 'DESC' },
      });
      if (existing) {
        return {
          status: 'duplicate',
          messageId: existing.metadata?.messageId,
        };
      }
      return { status: 'duplicate' };
    }

    const caseId = payload.caseId ?? null;
    if (caseId) {
      await this.ensureCaseBelongsToTenant(caseId, tenantId);
    }

    const sendResult = await this.whatsappService.sendTemplate(
      payload.to,
      payload.templateName,
      payload.params ?? [],
      payload.locale,
    );

    await this.appendConversationHistory(caseId ?? payload.to, {
      direction: 'outbound',
      body: payload.templateName,
      params: payload.params ?? [],
      timestamp: new Date().toISOString(),
    });

    await this.saveCommunicationLog({
      tenantId,
      caseId: caseId ?? undefined,
      direction: 'outbound',
      message: payload.templateName,
      metadata: {
        params: payload.params,
        locale: payload.locale,
        transport: 'whatsapp',
        messageId: sendResult.id,
        idempotencyKey,
        customMetadata: payload.metadata ?? {},
      },
    });

    await this.emitKafka('comms.message.sent', {
      tenantId,
      caseId,
      channel: 'whatsapp',
      template: payload.templateName,
      params: payload.params ?? [],
      messageId: sendResult.id,
    });

    return {
      status: 'sent',
      messageId: sendResult.id,
    };
  }

  async getConversationState(caseId: string) {
    const state = await this.stateStore.getState(caseId);
    if (!state) {
      return {
        caseId,
        status: 'not_initialized',
      };
    }
    return {
      caseId,
      lastIntent: state.lastIntent ?? null,
      lastTurnAt: state.lastTurnAt ?? null,
      locale: state.locale ?? 'en',
      confidence: state.lastConfidence ?? null,
      pending: {
        missingDocuments: state.missingDocuments ?? [],
        nextAppointmentAt: state.nextAppointmentAt ?? null,
        paymentReference: state.paymentReference ?? null,
      },
    };
  }

  private async processIncomingMessage(context: IncomingMessageContext) {
    const idempotentKey = `whatsapp:${context.messageId}`;
    const acquired = await this.acquireIdempotency(idempotentKey);
    if (!acquired) {
      this.logger.debug(
        {
          messageId: context.messageId,
          tenantId: context.tenantId,
        },
        'Skipping duplicate WhatsApp webhook message',
      );
      return;
    }

    await this.appendConversationHistory(context.caseId, {
      direction: 'inbound',
      body: context.text,
      metadata: context.metadata,
      timestamp: new Date().toISOString(),
    });

    const existingState =
      (await this.stateStore.getState(context.caseId)) ?? {};

    const updatedState = await this.stateStore.setState(context.caseId, {
      tenantId: context.tenantId,
      caseId: context.caseId,
      patientId: context.patientId ?? existingState.patientId,
      providerId: context.providerId ?? existingState.providerId,
      contact: {
        phone: context.from,
        lastMessageAt: new Date().toISOString(),
      },
      locale: context.locale ?? existingState.locale ?? 'en',
      lastTurnAt: new Date().toISOString(),
    });

    await this.saveCommunicationLog({
      tenantId: context.tenantId,
      caseId: context.caseId,
      direction: 'inbound',
      message: context.text,
      metadata: {
        transport: 'whatsapp',
        messageId: context.messageId,
        contact: context.from,
        raw: context.raw,
      },
    });

    await this.emitKafka('comms.message.received', {
      tenantId: context.tenantId,
      caseId: context.caseId,
      channel: 'whatsapp',
      messageId: context.messageId,
      body: context.text,
    });

    const history = await this.stateStore.getHistory(context.caseId, 10);
    const intent = await this.nluPipeline.detectIntent(
      context.text,
      context.locale ?? 'en',
      history,
    );

    await this.stateStore.setState(context.caseId, {
      lastIntent: intent.intent,
      lastConfidence: intent.confidence,
    });

    await this.emitKafka('conversation.intent.detected', {
      tenantId: context.tenantId,
      caseId: context.caseId,
      intent: intent.intent,
      confidence: intent.confidence,
      messageId: context.messageId,
    });

    const action = await this.performAction(
      context,
      updatedState,
      intent,
    );

    if (action.statePatch) {
      await this.stateStore.setState(context.caseId, action.statePatch);
    }

    if (action.escalate) {
      await this.emitKafka('conversation.escalated', {
        tenantId: context.tenantId,
        caseId: context.caseId,
        reason: intent.intent,
        metadata: action.metadata ?? {},
      });
    }

    if (action.template) {
      const sendResult = await this.whatsappService.sendTemplate(
        context.from,
        action.template,
        action.params,
        action.locale ?? context.locale,
      );

      await this.appendConversationHistory(context.caseId, {
        direction: 'outbound',
        body: action.template,
        params: action.params,
        timestamp: new Date().toISOString(),
      });

      await this.saveCommunicationLog({
        tenantId: context.tenantId,
        caseId: context.caseId,
        direction: 'outbound',
        message: action.template,
        metadata: {
          params: action.params,
          transport: 'whatsapp',
          messageId: sendResult.id,
          responseTo: context.messageId,
        },
      });

      await this.emitKafka('comms.message.sent', {
        tenantId: context.tenantId,
        caseId: context.caseId,
        channel: 'whatsapp',
        template: action.template,
        params: action.params,
        messageId: sendResult.id,
      });
    }
  }

  private async performAction(
    context: IncomingMessageContext,
    state: Record<string, any>,
    intent: DetectedIntent,
  ): Promise<ActionResult> {
    const locale = intent.locale ?? state.locale ?? 'en';
    switch (intent.intent) {
      case 'appointment.book': {
        const patientId = context.patientId ?? state.patientId;
        const providerId = context.providerId ?? state.providerId;
        const scheduledAt =
          intent.entities.date ?? state.pendingAppointmentDate;

        if (patientId && providerId && scheduledAt) {
          const appointment = await this.runWithTenant(
            context.tenantId,
            () =>
              this.appointmentsTool.book(context.caseId, {
                caseId: context.caseId,
                patientId,
                providerId,
                scheduledAt: new Date(scheduledAt).toISOString(),
                notes: `Automated booking triggered by WhatsApp ${context.messageId}`,
              }),
          );

          return {
            template: this.getTemplateName('appointment.confirmed'),
            params: [
              this.formatTime(appointment.scheduledAt, locale),
              providerId,
            ],
            locale,
            statePatch: {
              nextAppointmentAt: appointment.scheduledAt,
              lastIntent: intent.intent,
            },
          };
        }

        const slots = await this.runWithTenant(context.tenantId, () =>
          this.appointmentsTool.listSlots(context.caseId, {
            providerId: providerId ?? undefined,
          }),
        );

        const slotSummary = slots.slots
          .map(
            (slot) =>
              `${this.formatTime(slot.scheduledAt, locale)} with ${slot.providerName}`,
          )
          .join(' | ');

        return {
          template: this.getTemplateName('appointment.options'),
          params: [slotSummary],
          locale,
          statePatch: {
            pendingAppointmentOptions: slots.slots,
            pendingAppointmentDate: intent.entities.date ?? null,
          },
        };
      }
      case 'appointment.reschedule':
        await this.runWithTenant(context.tenantId, () =>
          this.appointmentsTool.reschedule(context.caseId, {
            reason: intent.entities.reason ?? 'user_requested',
          }),
        );
        return {
          template: this.getTemplateName('handoff'),
          params: ['Our care team will assist you with rescheduling shortly.'],
          locale,
          escalate: true,
          metadata: { intent: intent.intent },
        };
      case 'documents.missing': {
        const response = await this.runWithTenant(context.tenantId, () =>
          this.docsTool.missingDocs(context.caseId),
        );
        const missing =
          response.missing.length > 0
            ? response.missing.join(', ')
            : 'No pending documents';
        return {
          template: this.getTemplateName('documents.summary'),
          params: [missing],
          locale,
          statePatch: {
            missingDocuments: response.missing,
          },
        };
      }
      case 'documents.upload': {
        const requested =
          context.metadata.requestedDocument ??
          state.missingDocuments?.[0] ??
          'document';
        const presign = await this.runWithTenant(context.tenantId, () =>
          this.docsTool.presignUpload(
            context.caseId,
            `${requested}-${Date.now()}.pdf`,
            'application/pdf',
          ),
        );
        return {
          template: this.getTemplateName('documents.upload'),
          params: [presign.url],
          locale,
        };
      }
      case 'payment.link': {
        const reference =
          context.metadata.paymentReference ??
          state.paymentReference ??
          crypto.randomUUID();
        const amount =
          intent.entities.amount ??
          context.metadata.amount ??
          state.pendingAmount ??
          0;
        const currency =
          intent.entities.currency ??
          context.metadata.currency ??
          state.currency ??
          'EUR';
        const link = await this.runWithTenant(context.tenantId, () =>
          this.paymentsTool.createLink(context.caseId, {
            reference,
            amount,
            currency,
            successUrl:
              this.configService.get<string>('PAYMENT_SUCCESS_URL') ??
              'https://app.health-tourism.local/payments/success',
            cancelUrl:
              this.configService.get<string>('PAYMENT_CANCEL_URL') ??
              'https://app.health-tourism.local/payments/cancel',
          }),
        );
        return {
          template: this.getTemplateName('payment.link'),
          params: [link.url],
          locale,
          statePatch: {
            paymentReference: reference,
            pendingAmount: amount,
            currency,
          },
        };
      }
      case 'payment.status': {
        const reference =
          context.metadata.paymentReference ??
          state.paymentReference ??
          context.caseId;
        const status = await this.runWithTenant(context.tenantId, () =>
          this.paymentsTool.status(reference),
        );
        return {
          template: this.getTemplateName('payment.status'),
          params: [status.status ?? 'unknown'],
          locale,
        };
      }
      case 'travel.suggest': {
        const preferences: any = {
          originLocationCode:
            context.metadata.origin ?? state.originLocationCode,
          destinationLocationCode:
            context.metadata.destination ?? state.destinationLocationCode,
          departureDate:
            intent.entities.date ??
            context.metadata.departureDate ??
            state.departureDate,
          returnDate: context.metadata.returnDate ?? state.returnDate,
          adults: context.metadata.adults ?? '1',
          currencyCode: context.metadata.currency ?? state.currency ?? 'USD',
        };
        const travel = await this.runWithTenant(context.tenantId, () =>
          this.travelTool.flightSuggest(context.caseId, preferences),
        );
        const firstFlight = travel.flights[0];
        const summary = firstFlight
          ? `${firstFlight.segments[0]?.departure} ➝ ${firstFlight.segments.at(-1)?.arrival} ${firstFlight.price.total}${firstFlight.price.currency}`
          : 'No flights available';
        return {
          template: this.getTemplateName('travel.suggest'),
          params: [summary],
          locale,
          statePatch: {
            travelOptions: travel.flights,
          },
        };
      }
      case 'agent.handoff':
      case 'unknown':
      default:
        return {
          template: this.getTemplateName('handoff'),
          params: ['A care specialist will contact you shortly.'],
          locale,
          escalate: true,
          metadata: { confidence: intent.confidence },
        };
    }
  }

  private async ensureCaseBelongsToTenant(
    caseId: string,
    tenantId: string,
  ): Promise<void> {
    const exists = await this.caseRepository.findOne({
      where: { id: caseId, tenantId },
    });
    if (!exists) {
      throw new InternalServerErrorException(
        `Case ${caseId} is not associated with tenant ${tenantId}`,
      );
    }
  }

  private async appendConversationHistory(
    caseId: string,
    entry: Record<string, any>,
  ) {
    await this.stateStore.appendHistory(caseId, entry);
  }

  private extractIncomingMessages(payload: any): IncomingMessageContext[] {
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    const contexts: IncomingMessageContext[] = [];
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value ?? {};
        const messages = Array.isArray(value.messages) ? value.messages : [];
        const contacts = Array.isArray(value.contacts)
          ? value.contacts
          : [];
        for (const message of messages) {
          const contact = contacts.find(
            (item: any) => item.wa_id === message.from,
          );
          const metadata = {
            ...(value.metadata ?? {}),
            ...(message.context?.metadata ?? {}),
          };
          const locale =
            message.locale ??
            metadata.locale ??
            contact?.profile?.locale ??
            'en';
          const caseId =
            metadata.caseId ??
            message.context?.caseId ??
            contact?.profile?.caseId ??
            message.from;
          const tenantId =
            metadata.tenantId ??
            message.context?.tenantId ??
            'default';
          contexts.push({
            tenantId,
            caseId,
            patientId: metadata.patientId,
            providerId: metadata.providerId,
            locale,
            from: message.from,
            to: value.metadata?.phone_number_id ?? this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID') ?? '',
            messageId: message.id ?? crypto.randomUUID(),
            text: this.extractMessageBody(message),
            metadata,
            raw: message,
          });
        }
      }
    }
    return contexts;
  }

  private extractMessageBody(message: any): string {
    if (message?.text?.body) {
      return String(message.text.body);
    }
    if (message?.button?.text) {
      return String(message.button.text);
    }
    if (message?.interactive?.list_reply?.title) {
      return String(message.interactive.list_reply.title);
    }
    if (message?.interactive?.button_reply?.title) {
      return String(message.interactive.button_reply.title);
    }
    return '[unsupported-message]';
  }

  private async saveCommunicationLog(params: {
    tenantId: string;
    caseId?: string;
    direction: 'inbound' | 'outbound';
    message: string;
    metadata?: Record<string, any>;
  }) {
    const entity = this.commsRepository.create({
      tenantId: params.tenantId,
      caseId: params.caseId,
      channel: 'whatsapp',
      direction: params.direction,
      message: redactPII(params.message),
      metadata: params.metadata ?? {},
    });
    await this.commsRepository.save(entity);
  }

  private async emitKafka(topic: string, payload: Record<string, any>) {
    try {
      await this.kafkaService.emit(topic, payload);
    } catch (error) {
      this.logger.warn(
        {
          topic,
          error: (error as Error).message,
        },
        'Kafka emission failed in CommsService',
      );
    }
    try {
      await this.eventBus.publish(topic, payload);
    } catch (error) {
      this.logger.debug(
        {
          topic,
          error: (error as Error).message,
        },
        'Redis event bus publish failed in CommsService',
      );
    }
  }

  private async runWithTenant<T>(
    tenantId: string,
    callback: () => Promise<T>,
  ): Promise<T> {
    const requestId = crypto.randomUUID();
    return this.tenantContext.runWithContext(
      {
        tenantId,
        requestId,
      },
      () => callback(),
    );
  }

  private hashKey(key: string): string {
    return `idem:${crypto.createHash('sha256').update(key).digest('hex')}`;
  }

  private async acquireIdempotency(key: string): Promise<boolean> {
    const hashed = this.hashKey(key);
    return this.redisService.setnx(hashed, '1', IDEMPOTENCY_TTL_SECONDS);
  }

  private formatTime(timestamp: string, locale: string): string {
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(timestamp));
    } catch {
      return timestamp;
    }
  }

  private getTemplateName(slot: string): string {
    const mapping = this.configService.get<Record<string, string>>(
      'comms.templates',
    ) ?? {
      'appointment.confirmed': 'appt_confirmation',
      'appointment.options': 'appt_slots',
      handoff: 'handoff_human',
      'documents.summary': 'docs_missing_alert',
      'documents.upload': 'docs_upload_link',
      'payment.link': 'payment_link',
      'payment.status': 'payment_status',
      'travel.suggest': 'travel_options',
    };
    return mapping[slot] ?? slot;
  }
}
