import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HubEventDto } from '../dto/event.dto';
import { HubEventBusService } from '../services/event-bus.service';

@Injectable()
export class HubEventPublisher {
  private readonly logger = new Logger(HubEventPublisher.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly eventBus: HubEventBusService,
  ) {}

  async emit(event: HubEventDto): Promise<void> {
    this.logger.debug(`Emitting hub event ${event.id}`);
    this.eventEmitter.emit('hub.event.received', event);
    await this.eventBus.publishHubEvent(event);
  }

  async emitToAgents(topic: string, payload: Record<string, unknown>, tenantId?: string): Promise<void> {
    const envelope = {
      topic: tenantId ? `${tenantId}.${topic}` : topic,
      tenantId,
      payload,
      emittedAt: new Date().toISOString(),
    };
    this.logger.debug(`Publishing orchestrator->agent message on ${envelope.topic}`);
    this.eventEmitter.emit('hub.agent.dispatch', envelope);
    await this.eventBus.publishAgentEvent(envelope);
  }
}
