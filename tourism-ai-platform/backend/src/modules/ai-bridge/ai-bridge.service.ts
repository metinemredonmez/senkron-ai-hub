import {
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { PinoLogger } from 'nestjs-pino';
import { Client as LangSmithClient } from 'langsmith';
import { Redis } from 'ioredis';
import {
  SpanStatusCode,
  context,
  propagation,
  trace,
} from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import {
  ApprovalPayload,
  CaseOrchestrationPayload,
  CaseOrchestrationResponse,
  PricingPayload,
  PricingResponse,
  TravelPayload,
  TravelResponse,
} from './types';
import { RedisService } from '@/lib/nestjs-redis';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { KafkaService } from '@/lib/nestjs-kafka';
import { EncryptionService } from '@/lib/nestjs-encryption';

@Injectable()
export class AiBridgeService {
  private failureCount = 0;
  private circuitOpenUntil?: Date;

  private readonly langsmith?: LangSmithClient;
  private readonly redis: Redis;
  private readonly kafkaTopic: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly tenantContext: TenantContextService,
    private readonly encryptionService: EncryptionService,
    @Optional()
    private readonly kafkaService?: KafkaService,
  ) {
    this.logger.setContext(AiBridgeService.name);
    const apiKey = this.configService.get<string>('LANGSMITH_API_KEY');
    if (apiKey) {
      this.langsmith = new LangSmithClient({ apiKey });
    }
    this.redis = this.redisService.getClient();
    this.kafkaTopic =
      this.configService.get<string>('kafka.topics.aiBridgeEvents') ??
      'ai.bridge.events';
  }

  async startCaseOrchestration(
    payload: CaseOrchestrationPayload,
  ): Promise<CaseOrchestrationResponse> {
    const requestTenantId =
      payload.tenantId ?? this.tenantContext.getTenantId();

    try {
      const response = await this.request<CaseOrchestrationResponse>(
        'post',
        '/orchestrator/cases',
        {
          ...payload,
          tenantId: requestTenantId,
        },
      );
      await this.saveCheckpoint(requestTenantId, payload.caseId, response);
      await this.emitKafkaEvent('WORKFLOW_STARTED', {
        tenantId: requestTenantId,
        caseId: payload.caseId,
        summary: this.extractSummary(response),
        actorId: this.tenantContext.getActorId(),
      });
      return response;
    } catch (error) {
      await this.emitKafkaEvent('WORKFLOW_FAILED', {
        tenantId: requestTenantId,
        caseId: payload.caseId,
        stage: 'start',
        reason: this.extractError(error),
      });
      throw error;
    }
  }

  async resumeCaseWithApproval(
    payload: ApprovalPayload,
  ): Promise<CaseOrchestrationResponse> {
    const requestTenantId =
      payload.tenantId ?? this.tenantContext.getTenantId();
    try {
      const response = await this.request<CaseOrchestrationResponse>(
        'post',
        '/orchestrator/cases/approval',
        {
          ...payload,
          tenantId: requestTenantId,
        },
      );
      await this.saveCheckpoint(requestTenantId, payload.caseId, response);
      await this.emitKafkaEvent('WORKFLOW_RESUMED', {
        tenantId: requestTenantId,
        caseId: payload.caseId,
        approvalTaskId: payload.taskId,
        decision: payload.decision,
        summary: this.extractSummary(response),
        actorId: this.tenantContext.getActorId(),
      });
      return response;
    } catch (error) {
      await this.emitKafkaEvent('WORKFLOW_FAILED', {
        tenantId: requestTenantId,
        caseId: payload.caseId,
        stage: 'resume',
        reason: this.extractError(error),
        approvalTaskId: payload.taskId,
      });
      throw error;
    }
  }

  async calculatePricing(payload: PricingPayload): Promise<PricingResponse> {
    const response = await this.request<PricingResponse>(
      'post',
      '/orchestrator/pricing',
      payload,
    );
    await this.mergeCheckpoint(payload.tenantId, payload.caseId, {
      pricing: response,
    });
    return response;
  }

  async calculateTravel(payload: TravelPayload): Promise<TravelResponse> {
    const response = await this.request<TravelResponse>(
      'post',
      '/orchestrator/travel',
      payload,
    );
    await this.mergeCheckpoint(payload.tenantId, payload.caseId, {
      travelPlan: response,
    });
    return response;
  }

  async fetchCheckpoint<T = any>(
    tenantId: string,
    caseId: string,
  ): Promise<T | null> {
    const cacheKey = this.checkpointKey(tenantId, caseId);
    const raw = await this.redis.get(cacheKey);
    if (!raw) {
      return null;
    }
    const decrypted = this.encryptionService.decrypt(raw, `${tenantId}:${caseId}`);
    const source = decrypted || raw;
    try {
      return JSON.parse(source) as T;
    } catch {
      return null;
    }
  }

  async deleteCheckpoint(tenantId: string, caseId: string): Promise<void> {
    await this.redis.del(this.checkpointKey(tenantId, caseId));
  }

  private async request<T>(
    method: 'get' | 'post' | 'put' | 'patch',
    url: string,
    data?: any,
  ): Promise<T> {
    const tracer = trace.getTracer('ai-bridge');

    if (this.circuitOpenUntil && this.circuitOpenUntil > new Date()) {
      throw new ServiceUnavailableException(
        'AI orchestrator temporarily unavailable (circuit open)',
      );
    }

    let attempt = 0;
    const maxAttempts = 3;
    let lastError: unknown;

    while (attempt < maxAttempts) {
      const spanName = `${method.toUpperCase()} ${url}`;
      const activeContext = context.active();

      const result = await tracer.startActiveSpan(spanName, async (span) => {
        span.setAttribute(SemanticAttributes.HTTP_METHOD, method.toUpperCase());
        span.setAttribute(SemanticAttributes.HTTP_URL, url);
        span.setAttribute(
          'ai.case.tenant',
          data?.tenantId ?? this.tenantContext.getTenantId(),
        );
        if (data?.caseId) {
          span.setAttribute('ai.case.id', data.caseId);
        }

        try {
          const headers: Record<string, string> = {};
          if (data?.tenantId) {
            headers['x-tenant'] = data.tenantId;
          }
          propagation.inject(activeContext, headers);

          const response = await firstValueFrom(
            this.httpService.request<T>({
              method,
              url,
              data,
              headers,
            }),
          );

          this.failureCount = 0;
          span.setStatus({ code: SpanStatusCode.OK });
          span.setAttribute(
            SemanticAttributes.HTTP_STATUS_CODE,
            response.status ?? 200,
          );
          await this.logLangsmith({ method, url, data, response: response.data });
          return { data: response.data };
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: this.extractError(error),
          });
          await this.logLangsmith({ method, url, data, error });
          throw error;
        } finally {
          span.end();
        }
      });

      try {
        return result.data;
      } catch (error) {
        lastError = error;
        attempt += 1;
        this.failureCount += 1;
        const delay = Math.pow(2, attempt) * 100;
        this.logger.warn(
          { attempt, url, error: this.extractError(error) },
          'AI orchestrator request failed',
        );
        if (attempt >= maxAttempts) {
          this.openCircuitIfNeeded();
          break;
        }
        await this.sleep(delay);
      }
    }

    throw new ServiceUnavailableException(
      `Failed to call orchestrator after ${maxAttempts} attempts: ${this.extractError(
        lastError,
      )}`,
    );
  }

  private extractError(error: unknown): string {
    if (error instanceof AxiosError) {
      return (
        error.response?.data?.message ??
        error.message ??
        'Unknown orchestrator error'
      );
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown error';
  }

  private openCircuitIfNeeded() {
    if (this.failureCount >= 5) {
      const timeoutMs = 30_000;
      this.circuitOpenUntil = new Date(Date.now() + timeoutMs);
      this.logger.error({ timeoutMs }, 'Opening AI bridge circuit breaker');
    }
  }

  private async sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async logLangsmith(input: {
    method: string;
    url: string;
    data?: any;
    response?: any;
    error?: unknown;
  }) {
    if (!this.langsmith) {
      return;
    }
    try {
      const client = this.langsmith as any;
      if (client?.runs?.create) {
        await client.runs.create({
          name: 'ai-bridge-request',
          inputs: {
            method: input.method,
            url: input.url,
            payload: input.data,
          },
          outputs: input.response,
          error: input.error ? this.extractError(input.error) : undefined,
        });
      }
    } catch (error) {
      this.logger.debug({ error }, 'Failed to log to LangSmith');
    }
  }

  private checkpointKey(tenantId: string, caseId: string) {
    return this.redisService.buildTenantKey(tenantId, 'cases', 'fsm', caseId);
  }

  private async saveCheckpoint(
    tenantId: string,
    caseId: string,
    payload: Record<string, any>,
  ) {
    const cacheKey = this.checkpointKey(tenantId, caseId);
    const encrypted = this.encryptionService.encrypt(
      JSON.stringify(payload),
      `${tenantId}:${caseId}`,
    );
    await this.redis.set(cacheKey, JSON.stringify(encrypted), 'EX', 60 * 60);
    await this.emitKafkaEvent('CHECKPOINT_UPDATED', {
      tenantId,
      caseId,
      checkpointKey: cacheKey,
      summary: this.extractSummary(payload),
    });
  }

  private async mergeCheckpoint(
    tenantId: string,
    caseId: string,
    payload: Record<string, any>,
  ) {
    const current = await this.fetchCheckpoint<Record<string, any>>(
      tenantId,
      caseId,
    );
    await this.saveCheckpoint(tenantId, caseId, {
      ...(current ?? {}),
      ...payload,
    });
  }

  private async emitKafkaEvent(
    eventType: string,
    event: Record<string, any>,
  ): Promise<void> {
    if (!this.kafkaService) {
      return;
    }
    try {
      await this.kafkaService.emit(this.kafkaTopic, {
        eventType,
        timestamp: new Date().toISOString(),
        requestId: this.tenantContext.getRequestId(),
        ...event,
      });
    } catch (error) {
      this.logger.warn(
        { eventType, error: this.extractError(error) },
        'Failed to emit AI bridge Kafka event',
      );
    }
  }

  private extractSummary(state: Record<string, any> | null | undefined) {
    if (!state || typeof state !== 'object') {
      return {};
    }
    return {
      status: state.status ?? null,
      stage: state.stage ?? null,
      currentNode: state.currentNode ?? null,
      approvals: Array.isArray(state.approvals)
        ? state.approvals.map((approval: any) => ({
            id: approval?.id,
            type: approval?.type,
            status: approval?.status ?? null,
          }))
        : [],
      pricingReady: Boolean(state.pricing),
      travelPlanReady: Boolean(state.travelPlan),
    };
  }
}
