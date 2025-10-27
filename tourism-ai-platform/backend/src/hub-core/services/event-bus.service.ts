import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KafkaService } from '@/lib/nestjs-kafka';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { HubEventDto } from '../dto/event.dto';

@Injectable()
export class HubEventBusService {
  private readonly logger = new Logger(HubEventBusService.name);
  private readonly hubTopicSuffix: string;
  private readonly agentTopicSuffix: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly kafkaService: KafkaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly tenantContext: TenantContextService,
  ) {
    this.hubTopicSuffix =
      this.configService.get<string>('hub.kafkaHubSuffix') ??
      this.configService.get<string>('HUB_KAFKA_HUB_SUFFIX') ??
      'hub.events';
    this.agentTopicSuffix =
      this.configService.get<string>('hub.kafkaAgentSuffix') ??
      this.configService.get<string>('HUB_KAFKA_AGENT_SUFFIX') ??
      'ai.agent.events';
  }

  async publish(topic: string, payload: Record<string, unknown>): Promise<void> {
    this.eventEmitter.emit(topic, payload);
    try {
      await this.kafkaService.emit(topic, {
        ...payload,
        emittedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish Kafka event on ${topic}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async publishAgentEvent(payload: Record<string, unknown>): Promise<void> {
    const tenantId =
      this.extractTenantId(payload) ?? this.resolveTenantContext() ?? 'system';
    const topic = this.agentTopic(tenantId);
    await this.publish(topic, { ...payload, tenantId });
  }

  async publishHubEvent(event: HubEventDto): Promise<void> {
    const tenantId = event.tenantId ?? this.resolveTenantContext() ?? 'system';
    const topic = this.hubTopic(tenantId);
    await this.publish(topic, {
      ...event,
      tenantId,
    });
  }

  private agentTopic(tenantId: string): string {
    return `tenant.${tenantId}.${this.agentTopicSuffix}`;
  }

  private hubTopic(tenantId: string): string {
    return `tenant.${tenantId}.${this.hubTopicSuffix}`;
  }

  private extractTenantId(payload: Record<string, unknown>): string | undefined {
    const raw =
      (payload?.tenantId as string | undefined) ??
      (payload?.tenant_id as string | undefined) ??
      (payload?.['tenant'] as string | undefined);
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
    return undefined;
  }

  private resolveTenantContext(): string | undefined {
    try {
      return this.tenantContext.getTenantId();
    } catch {
      return undefined;
    }
  }
}
