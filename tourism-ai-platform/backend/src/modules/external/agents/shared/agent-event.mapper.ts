import { Injectable } from '@nestjs/common';
import { HubEventDto } from '../../../../hub-core/dto/event.dto';

@Injectable()
export class AgentEventMapper {
  toHubEvent(options: {
    id: string;
    tenantId: string;
    agentName: string;
    type: string;
    source?: string;
    payload?: Record<string, unknown>;
    channel?: string;
    sessionId?: string;
    correlationId?: string;
  }): HubEventDto {
    return {
      id: options.id,
      tenantId: options.tenantId,
      type: options.type,
      source: options.source ?? options.agentName,
      timestamp: new Date(),
      targetAgent: options.agentName,
      channel: options.channel,
      payload: options.payload ?? {},
      sessionId: options.sessionId,
      correlationId: options.correlationId,
      metadata: {},
    };
  }
}
