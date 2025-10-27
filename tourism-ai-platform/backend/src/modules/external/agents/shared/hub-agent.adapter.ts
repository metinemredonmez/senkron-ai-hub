import { Injectable, Logger } from '@nestjs/common';
import { HubEventPublisher } from '../../../../hub-core/events/hub-event.publisher';

@Injectable()
export class HubAgentAdapter {
  private readonly logger = new Logger(HubAgentAdapter.name);

  constructor(private readonly hubEventPublisher: HubEventPublisher) {}

  async publishAgentEvent(topic: string, payload: Record<string, unknown>, tenantId?: string): Promise<void> {
    this.logger.debug(`Publishing agent event on ${topic}`);
    await this.hubEventPublisher.emitToAgents(topic, payload, tenantId);
  }
}
