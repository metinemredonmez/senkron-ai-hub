import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, Consumer, KafkaConfig, ConsumerConfig, EachMessagePayload } from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private readonly enabled: boolean;
  private readonly kafka?: Kafka;
  private producer?: Producer;
  private readonly consumers: Consumer[] = [];
  private readonly clientId: string;
  private readonly groupId: string;

  constructor(private readonly configService: ConfigService) {
    const enabledEnv =
      this.configService.get<string>('KAFKA_ENABLED') ??
      process.env.KAFKA_ENABLED ??
      'true';
    let enabled = enabledEnv.toLowerCase() !== 'false';
    const brokersRaw =
      this.configService.get<string>('KAFKA_BROKERS') ??
      process.env.KAFKA_BROKERS ??
      '';
    const brokers = brokersRaw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    this.clientId =
      this.configService.get<string>('KAFKA_CLIENT_ID') ??
      process.env.KAFKA_CLIENT_ID ??
      'synchron-ai-backend';
    this.groupId =
      this.configService.get<string>('KAFKA_GROUP_ID') ??
      process.env.KAFKA_GROUP_ID ??
      `${this.clientId}-group`;

    if (!enabled) {
      this.logger.warn('Kafka integration disabled via KAFKA_ENABLED=false');
      this.enabled = false;
      return;
    }

    if (!brokers.length) {
      this.logger.warn('Kafka disabled: KAFKA_BROKERS not configured');
      this.enabled = false;
      return;
    }

    const sslFlag =
      this.configService.get<string | boolean>('KAFKA_SSL') ??
      process.env.KAFKA_SSL ??
      false;
    const sslEnabled = typeof sslFlag === 'string'
      ? sslFlag.toLowerCase() === 'true'
      : Boolean(sslFlag);

    const kafkaConfig: KafkaConfig = {
      clientId: this.clientId,
      brokers,
      ssl: sslEnabled || undefined,
    };

    this.kafka = new Kafka(kafkaConfig);
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled && !!this.kafka;
  }

  async emit(topic: string, message: unknown): Promise<void> {
    if (!this.isEnabled() || !this.kafka) {
      this.logger.debug(
        { topic },
        'Kafka emit skipped (service disabled or not configured)',
      );
      return;
    }

    const producer = await this.getProducer();

    await producer.send({
      topic,
      messages: [
        {
          value:
            typeof message === 'string'
              ? message
              : JSON.stringify(message ?? {}),
        },
      ],
    });
  }

  async consume(
    topic: string,
    handler: (payload: EachMessagePayload) => Promise<void> | void,
    config?: Partial<ConsumerConfig>,
  ): Promise<Consumer | null> {
    if (!this.isEnabled() || !this.kafka) {
      this.logger.debug(
        { topic },
        'Kafka consume skipped (service disabled or not configured)',
      );
      return null;
    }

    const consumer = this.kafka.consumer({
      groupId: config?.groupId ?? this.groupId,
      allowAutoTopicCreation: config?.allowAutoTopicCreation ?? true,
      retry: config?.retry,
    });

    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });
    await consumer.run({
      eachMessage: async (payload) => {
        try {
          await handler(payload);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Kafka consumer handler failed for topic ${topic}: ${message}`,
          );
        }
      },
    });

    this.consumers.push(consumer);
    return consumer;
  }

  formatTenantTopic(tenantId: string, suffix: string): string {
    const cleanedTenant = (tenantId ?? 'system').toString().trim() || 'system';
    const cleanedSuffix = suffix.replace(/^\.+/, '');
    return `tenant.${cleanedTenant}.${cleanedSuffix}`;
  }

  private async getProducer(): Promise<Producer> {
    if (this.producer) {
      return this.producer;
    }

    if (!this.kafka) {
      throw new Error('Kafka client not initialised');
    }

    this.producer = this.kafka.producer();
    await this.producer.connect();
    this.logger.log('Kafka producer connected');
    return this.producer;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
    }
    await Promise.all(
      this.consumers.map(async (consumer) => consumer.disconnect()),
    );
  }
}
