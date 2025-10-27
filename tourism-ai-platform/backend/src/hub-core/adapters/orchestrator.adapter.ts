import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosRequestConfig } from 'axios';
import { lastValueFrom } from 'rxjs';
import { HubEventDto } from '../dto/event.dto';
import { AgentDto } from '../dto/agent.dto';
import { TenantContextService } from '../../common/context/tenant-context.service';

@Injectable()
export class OrchestratorAdapter {
  private readonly logger = new Logger(OrchestratorAdapter.name);
  private readonly baseUrl: string;
  private readonly defaultTimeout: number;

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService,
    private readonly tenantContext: TenantContextService,
  ) {
    this.baseUrl = this.configService.get<string>('integrations.orchestrator.baseUrl') ?? process.env.AI_ORCHESTRATOR_URL ?? 'http://localhost:8100';
    this.defaultTimeout = this.configService.get<number>('integrations.orchestrator.timeoutMs') ?? 10000;
  }

  private requestConfig(overrides?: AxiosRequestConfig, tenantId?: string): AxiosRequestConfig {
    const { headers: overrideHeaders = {}, ...rest } = overrides ?? {};
    return {
      baseURL: this.baseUrl,
      timeout: this.defaultTimeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Client': 'synchron-ai-hub',
        ...this.tenantHeaders(tenantId),
        ...overrideHeaders,
      },
      ...rest,
    };
  }

  async dispatchEvent(event: HubEventDto): Promise<void> {
    const config = this.requestConfig(undefined, event.tenantId);
    await lastValueFrom(
      this.http.post('/hub/events/publish', event, config),
    );
    this.logger.debug(`Event ${event.id} dispatched to orchestrator`);
  }

  async invokeAgent(agentName: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const tenantId = (payload?.['tenantId'] as string | undefined) ?? this.safeTenantId();
    const config = this.requestConfig(undefined, tenantId);
    const response = await lastValueFrom(
      this.http.post(`/agents/${agentName}/run`, payload, config),
    );
    this.logger.debug(`Agent ${agentName} invoked via orchestrator`);
    return response.data as Record<string, unknown>;
  }

  async listAgents(tenantId?: string): Promise<AgentDto[]> {
    const config = this.requestConfig(undefined, tenantId);
    const response = await lastValueFrom(
      this.http.get('/hub/registry', config),
    );
    return (response.data as AgentDto[]) ?? [];
  }

  private tenantHeaders(tenantId?: string): Record<string, string> {
    const resolved = tenantId ?? this.safeTenantId();
    if (!resolved) {
      return {};
    }
    return {
      'X-Tenant': resolved,
    };
  }

  private safeTenantId(): string | undefined {
    try {
      return this.tenantContext.getTenantId();
    } catch {
      return undefined;
    }
  }
}
