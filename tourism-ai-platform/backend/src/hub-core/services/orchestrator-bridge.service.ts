import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HubEventDto } from '../dto/event.dto';
import { OrchestratorAdapter } from '../adapters/orchestrator.adapter';
import { MetricsService } from './metrics.service';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { TenantContextService } from '../../common/context/tenant-context.service';

@Injectable()
export class OrchestratorBridgeService {
  private readonly logger = new Logger(OrchestratorBridgeService.name);
  private readonly tracer = trace.getTracer('hub-core.orchestrator');

  constructor(
    private readonly orchestratorAdapter: OrchestratorAdapter,
    private readonly metricsService: MetricsService,
    private readonly tenantContext: TenantContextService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async dispatch(event: HubEventDto): Promise<void> {
    this.logger.debug(`Dispatching event ${event.id} for tenant ${event.tenantId}`);
    const requestId =
      (event.metadata?.['requestId'] as string | undefined) ??
      event.correlationId ??
      this.tryGetRequestId();

    const span = this.tracer.startSpan('ai.orchestrator.dispatch', {
      attributes: {
        tenant_id: event.tenantId,
        event_id: event.id,
        event_type: event.type,
        target_agent: event.targetAgent ?? 'orchestrator',
        request_id: requestId ?? 'unknown',
      },
    });
    try {
      await this.orchestratorAdapter.dispatchEvent(event);
      span.setStatus({ code: SpanStatusCode.OK });
      this.metricsService.markOrchestratorHealthy(true);
      this.metricsService.trackTenantRequest(
        event.tenantId,
        event.targetAgent ?? 'orchestrator',
        event.channel ?? 'system',
      );
    } catch (error) {
      this.metricsService.markOrchestratorHealthy(false);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error) {
        span.recordException(error);
      }
      throw error;
    } finally {
      span.end();
    }
  }

  async forwardAgentMessage(topic: string, payload: Record<string, unknown>, tenantId?: string): Promise<void> {
    this.logger.debug(`Forwarding orchestrator message on topic ${topic}`);
    this.eventEmitter.emit('hub.orchestrator.agent', {
      topic,
      tenantId,
      payload,
    });
  }

  async invokeAgent(agentName: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const start = Date.now();
    const tenantId = this.resolveTenantFromPayload(payload);
    try {
      const result = await this.orchestratorAdapter.invokeAgent(agentName, payload);
      const durationMs = Date.now() - start;
      this.metricsService.trackAgentLatency(agentName, tenantId, durationMs);
      return result;
    } catch (error) {
      const durationMs = Date.now() - start;
      this.metricsService.trackAgentLatency(agentName, tenantId, durationMs);
      this.metricsService.trackAgentError(agentName, tenantId, error instanceof Error ? error.name : 'UnknownError');
      throw error;
    }
  }

  private resolveTenantFromPayload(payload: Record<string, unknown>): string {
    const explicit = payload?.['tenantId'];
    if (typeof explicit === 'string' && explicit.trim().length > 0) {
      return explicit.trim();
    }
    try {
      return this.tenantContext.getTenantId();
    } catch {
      return 'unknown';
    }
  }

  private tryGetRequestId(): string | undefined {
    try {
      return this.tenantContext.getRequestId();
    } catch {
      return undefined;
    }
  }
}
