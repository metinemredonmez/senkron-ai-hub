import { Logger } from '@nestjs/common';
import { HubAgentAdapter } from './hub-agent.adapter';

export abstract class HubAgentBaseService {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly hubAdapter: HubAgentAdapter) {}

  protected async publish(topic: string, tenantId: string, payload: Record<string, unknown>): Promise<void> {
    this.logger.debug(`Publishing ${topic} for tenant ${tenantId}`);
    await this.hubAdapter.publishAgentEvent(topic, { ...payload, tenantId }, tenantId);
  }
}
