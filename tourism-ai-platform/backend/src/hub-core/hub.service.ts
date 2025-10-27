import { Injectable } from '@nestjs/common';
import { HubEventDto } from './dto/event.dto';
import { AgentDto } from './dto/agent.dto';
import { HubEventPublisher } from './events/hub-event.publisher';
import { RegistrySyncService } from './services/registry-sync.service';
import { OrchestratorBridgeService } from './services/orchestrator-bridge.service';
import { MetricsService } from './services/metrics.service';
import { TenantContextService } from '../common/context/tenant-context.service';

@Injectable()
export class HubService {
  constructor(
    private readonly publisher: HubEventPublisher,
    private readonly registrySync: RegistrySyncService,
    private readonly orchestratorBridge: OrchestratorBridgeService,
    private readonly metricsService: MetricsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async publishEvent(event: HubEventDto): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    const scopedEvent: HubEventDto = {
      ...event,
      tenantId,
    };
    await this.publisher.emit(scopedEvent);
    await this.orchestratorBridge.dispatch(scopedEvent);
  }

  async listAgents(): Promise<AgentDto[]> {
    return this.registrySync.listAgents();
  }

  async registerAgent(agent: AgentDto): Promise<void> {
    await this.registrySync.registerAgent(agent);
  }

  async getMetrics(): Promise<string> {
    return this.metricsService.getSnapshot();
  }
}
