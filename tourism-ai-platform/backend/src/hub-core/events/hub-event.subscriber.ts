import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { HubEventPublisher } from './hub-event.publisher';

interface OrchestratorAgentEnvelope {
  topic: string;
  tenantId?: string;
  payload: Record<string, unknown>;
  emittedAt?: string;
}

@Injectable()
export class HubEventSubscriber {
  private readonly logger = new Logger(HubEventSubscriber.name);

  constructor(private readonly publisher: HubEventPublisher) {}

  @OnEvent('hub.orchestrator.agent')
  async handleOrchestratorAgentEvent(envelope: OrchestratorAgentEnvelope): Promise<void> {
    this.logger.debug(`Received orchestrator agent envelope for topic ${envelope.topic}`);
    await this.publisher.emitToAgents(envelope.topic, envelope.payload, envelope.tenantId);
  }
}
