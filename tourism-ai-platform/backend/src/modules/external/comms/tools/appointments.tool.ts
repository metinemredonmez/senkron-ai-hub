import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Doctor365Service } from '../../doctor365/doctor365.service';
import { KafkaService } from '@/lib/nestjs-kafka';
import { TenantContextService } from '../../../../common/context/tenant-context.service';
import crypto from 'crypto';

interface SlotRequest {
  specialty?: string;
  language?: string;
  providerId?: string;
  date?: string;
}

interface AppointmentRequest {
  caseId: string;
  patientId: string;
  providerId: string;
  scheduledAt: string;
  channel?: 'in_person' | 'video' | 'phone';
  notes?: string;
}

@Injectable()
export class AppointmentsTool {
  constructor(
    private readonly doctor365Service: Doctor365Service,
    private readonly kafkaService: KafkaService,
    private readonly tenantContext: TenantContextService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AppointmentsTool.name);
  }

  async listSlots(caseId: string, request: SlotRequest = {}) {
    const tenantId = this.safeTenantId();
    const providers = await this.doctor365Service.listProviders({
      specialty: request.specialty,
      language: request.language,
      page: 1,
      size: 5,
    });

    const baseDate = request.date
      ? new Date(request.date)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const slots = providers.providers.slice(0, 3).map((provider, index) => {
      const scheduledAt = new Date(
        baseDate.getTime() + index * 60 * 60 * 1000,
      ).toISOString();
      return {
        providerId: provider.id,
        providerName: provider.name,
        scheduledAt,
        location: provider.location,
        languageSupport: provider.languageSupport,
      };
    });

    await this.emitKafka('conversation.intent.detected', {
      tenantId,
      caseId,
      intent: 'appointment.list',
      slots: slots.length,
    });

    return { slots };
  }

  async book(caseId: string, request: AppointmentRequest) {
    const tenantId = this.safeTenantId();
    const appointmentId = crypto.randomUUID();
    const response = await this.doctor365Service.createAppointment(
      {
        doktor365PatientId: request.patientId,
        doktor365ProviderId: request.providerId,
        appointmentId,
        scheduledAt: request.scheduledAt,
        channel: request.channel ?? 'in_person',
        notes: request.notes,
      },
      appointmentId,
    );

    await this.emitKafka('conversation.intent.detected', {
      tenantId,
      caseId,
      intent: 'appointment.book',
      appointmentId: response.doktor365AppointmentId,
      scheduledAt: response.scheduledAt,
    });

    return response;
  }

  async reschedule(caseId: string, payload: { reason?: string }) {
    const tenantId = this.safeTenantId();
    await this.emitKafka('conversation.escalated', {
      tenantId,
      caseId,
      reason: 'RESCHEDULE_REQUEST',
      metadata: payload,
    });
    return {
      status: 'escalated',
      reason: payload.reason ?? 'Agent follow-up required',
    };
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
        'Failed to emit Kafka event from AppointmentsTool',
      );
    }
  }

  private safeTenantId(): string {
    try {
      return this.tenantContext.getTenantId();
    } catch {
      return 'unknown';
    }
  }
}
