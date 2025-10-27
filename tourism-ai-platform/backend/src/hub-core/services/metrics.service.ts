import { Injectable, Logger } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';
import { PrometheusService } from '../../lib/nestjs-prometheus';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly registry: Registry;
  private readonly agentLatency: Histogram<string>;
  private readonly tenantRequest: Counter<string>;
  private readonly agentErrors: Counter<string>;
  private readonly orchestratorGauge: Gauge<string>;

  constructor(private readonly prometheusService: PrometheusService) {
    this.registry = this.prometheusService.getRegistry();

    this.agentLatency = new Histogram({
      name: 'hub_agent_latency_seconds',
      help: 'Latency distribution for agent executions',
      labelNames: ['tenant_id', 'agent_name'],
      registers: [this.registry],
      buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10],
    });

    this.tenantRequest = new Counter({
      name: 'hub_tenant_request_total',
      help: 'Total orchestrator routed requests by tenant and agent',
      labelNames: ['tenant_id', 'agent_name', 'channel'],
      registers: [this.registry],
    });

    this.agentErrors = new Counter({
      name: 'hub_agent_error_total',
      help: 'Total agent execution errors by agent and tenant',
      labelNames: ['agent_name', 'tenant_id', 'error_type'],
      registers: [this.registry],
    });

    this.orchestratorGauge = new Gauge({
      name: 'hub_orchestrator_health',
      help: 'Simple heartbeat gauge reporting orchestrator connectivity (1 healthy / 0 down)',
      registers: [this.registry],
    });
  }

  trackTenantRequest(tenantId: string, agentName: string, channel = 'system'): void {
    this.tenantRequest.labels(tenantId, agentName, channel).inc();
  }

  trackAgentLatency(agentName: string, tenantId: string, durationMs: number): void {
    const seconds = durationMs / 1000;
    this.agentLatency.labels(tenantId, agentName).observe(seconds);
  }

  trackAgentError(agentName: string, tenantId: string, errorType: string): void {
    this.agentErrors.labels(agentName, tenantId, errorType).inc();
  }

  markOrchestratorHealthy(isHealthy: boolean): void {
    this.orchestratorGauge.set(isHealthy ? 1 : 0);
  }

  async pushMetricsToTempo(): Promise<void> {
    // Placeholder for future Tempo integration (OTLP/HTTP). For now we only log the invocation.
    this.logger.debug('pushMetricsToTempo invoked - integrate with OTLP exporter when available');
  }

  async getSnapshot(): Promise<string> {
    return this.registry.metrics();
  }
}
