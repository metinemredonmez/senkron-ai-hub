import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PaymentClient } from '../../../../common/integrations/payment.client';
import { KafkaService } from '@/lib/nestjs-kafka';
import { Redis } from 'ioredis';
import { RedisService } from '@/lib/nestjs-redis';
import { TenantContextService } from '../../../../common/context/tenant-context.service';

interface PaymentLinkRequest {
  reference: string;
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}

@Injectable()
export class PaymentsTool {
  private readonly redis: Redis;

  constructor(
    private readonly paymentClient: PaymentClient,
    private readonly kafkaService: KafkaService,
    redisService: RedisService,
    private readonly tenantContext: TenantContextService,
    private readonly logger: PinoLogger,
  ) {
    this.redis = redisService.getClient();
    this.logger.setContext(PaymentsTool.name);
  }

  async createLink(caseId: string, payload: PaymentLinkRequest) {
    const tenantId = this.safeTenantId();
    const link = await this.paymentClient.generatePaymentLink({
      amount: payload.amount,
      currency: payload.currency,
      reference: payload.reference,
      successUrl: payload.successUrl,
      cancelUrl: payload.cancelUrl,
    });

    await this.emitKafka('conversation.intent.detected', {
      tenantId,
      caseId,
      intent: 'payment.link',
      reference: payload.reference,
    });

    return link;
  }

  async status(reference: string) {
    const tenantId = this.safeTenantId();
    const cacheKey = `payment:${reference}`;
    const cached = await this.redis.get(cacheKey);
    const snapshot = cached ? JSON.parse(cached) : null;

    await this.emitKafka('conversation.intent.detected', {
      tenantId,
      reference,
      intent: 'payment.status',
      status: snapshot?.status ?? 'unknown',
    });

    return snapshot ?? { status: 'unknown' };
  }

  private async emitKafka(topic: string, payload: Record<string, any>) {
    try {
      await this.kafkaService.emit(topic, payload);
    } catch (error) {
      this.logger.warn(
        {
          topic,
          error: (error as Error).message,
        },
        'Failed to emit Kafka event from PaymentsTool',
      );
    }
  }

  private safeTenantId(): string {
    try {
      return this.tenantContext.getTenantId();
    } catch {
      return 'unknown';
    }
  }
}
