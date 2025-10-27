import { Module } from '@nestjs/common';
import { HubCoreModule } from '../../../hub-core/hub.module';
import { HubAgentAdapter } from './shared/hub-agent.adapter';
import { AgentEventMapper } from './shared/agent-event.mapper';

@Module({
  imports: [HubCoreModule],
  providers: [HubAgentAdapter, AgentEventMapper],
  exports: [HubAgentAdapter, AgentEventMapper],
})
export class AgentsModule {}
