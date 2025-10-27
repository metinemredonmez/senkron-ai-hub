import { Injectable } from '@nestjs/common';
import crypto from 'crypto';
import { Redis } from 'ioredis';
import { RedisService } from '@/lib/nestjs-redis';

@Injectable()
export class IdempotencyService {
  private readonly redis: Redis;
  private readonly prefix = 'idem';

  constructor(private readonly redisService: RedisService) {
    this.redis = this.redisService.getClient();
  }

  private namespaced(key: string) {
    const digest = crypto.createHash('sha256').update(key).digest('hex');
    return `${this.prefix}:${digest}`;
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(this.namespaced(key));
    return result === 1;
  }

  async remember<T>(
    key: string,
    value: T,
    ttlSeconds = 60 * 60,
  ): Promise<T> {
    await this.redisService.set(
      this.namespaced(key),
      JSON.stringify(value ?? true),
      ttlSeconds,
    );
    return value;
  }

  async acquire(
    key: string,
    ttlSeconds = 60 * 5,
    value: string = '1',
  ): Promise<boolean> {
    return this.redisService.setnx(
      this.namespaced(key),
      value,
      ttlSeconds,
    );
  }

  async release(key: string): Promise<void> {
    await this.redisService.del(this.namespaced(key));
  }
}
