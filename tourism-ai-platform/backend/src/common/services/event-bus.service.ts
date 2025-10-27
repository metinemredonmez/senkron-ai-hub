import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Redis } from 'ioredis';
import { RedisService } from '@/lib/nestjs-redis';

@Injectable()
export class EventBusService {
  private readonly redis: Redis;

  constructor(
    private readonly logger: PinoLogger,
    private readonly redisService: RedisService,
  ) {
    this.redis = this.redisService.getClient();
    this.logger.setContext(EventBusService.name);
  }

  async publish(channel: string, payload: Record<string, any>): Promise<void> {
    await this.redis.publish(channel, JSON.stringify(payload));
    this.logger.debug({ channel, payload }, 'Event published');
  }

}
