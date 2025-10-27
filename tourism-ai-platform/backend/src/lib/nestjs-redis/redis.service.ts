import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis, { Redis, RedisKey, RedisValue } from 'ioredis';

const DEFAULT_SCAN_COUNT = 100;

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('REDIS_URL') ?? process.env.REDIS_URL;
    const options = {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
    };

    if (url) {
      this.client = new IORedis(url, options);
    } else {
      this.client = new IORedis({
        host: this.configService.get<string>('REDIS_HOST', '127.0.0.1'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
        password: this.configService.get<string>('REDIS_PASSWORD') ?? undefined,
        db: this.configService.get<number>('REDIS_DB') ?? undefined,
        ...options,
      });
    }

    this.client.on('connect', () => {
      this.logger.log('Redis connection established');
    });

    this.client.on('error', (error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis connection error: ${message}`);
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: RedisKey): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: RedisKey, value: RedisValue, ttlSeconds?: number): Promise<'OK' | null> {
    if (typeof ttlSeconds === 'number' && Number.isFinite(ttlSeconds)) {
      return this.client.set(key, value, 'EX', ttlSeconds);
    }
    return this.client.set(key, value);
  }

  async setex(key: RedisKey, ttlSeconds: number, value: RedisValue): Promise<'OK'> {
    return this.client.setex(key, ttlSeconds, value);
  }

  async setnx(
    key: RedisKey,
    value: RedisValue,
    ttlSeconds?: number,
  ): Promise<boolean> {
    if (typeof ttlSeconds === 'number' && Number.isFinite(ttlSeconds)) {
      const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    }
    const result = await this.client.set(key, value, 'NX');
    return result === 'OK';
  }

  async del(...keys: RedisKey[]): Promise<number> {
    if (!keys.length) {
      return 0;
    }
    return this.client.del(...keys);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async scan(pattern: string, count = DEFAULT_SCAN_COUNT): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, found] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', count);
      cursor = nextCursor;
      if (Array.isArray(found) && found.length > 0) {
        keys.push(...found);
      }
    } while (cursor !== '0');

    return keys;
  }

  formatKey(tenantId: string, service: string, key: string): string {
    const safeTenant = (tenantId ?? 'system').toString().trim() || 'system';
    const safeService = (service ?? 'app').toString().trim() || 'app';
    const safeKey = (key ?? 'default').toString().trim();
    return `${safeTenant}:${safeService}:${safeKey}`;
  }

  buildTenantKey(tenantId: string, service: string, ...segments: (string | number)[]): string {
    const normalized = segments
      .map((segment) => segment?.toString().trim())
      .filter((segment): segment is string => Boolean(segment && segment.length > 0));
    const key = normalized.length ? normalized.join(':') : 'default';
    return this.formatKey(tenantId, service, key);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
