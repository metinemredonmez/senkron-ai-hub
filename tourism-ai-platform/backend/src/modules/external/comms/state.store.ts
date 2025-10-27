import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { RedisService } from '@/lib/nestjs-redis';
import { PinoLogger } from 'nestjs-pino';
import { TenantContextService } from '../../../common/context/tenant-context.service';

const STATE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const HISTORY_LIMIT = 50;

@Injectable()
export class StateStore {
  private readonly redis: Redis;
  private readonly redisService: RedisService;

  constructor(
    redisService: RedisService,
    private readonly tenantContext: TenantContextService,
    private readonly logger: PinoLogger,
  ) {
    this.redisService = redisService;
    this.redis = redisService.getClient();
    this.logger.setContext(StateStore.name);
  }

  async getState<T extends Record<string, any> = Record<string, any>>(
    caseId: string,
  ): Promise<T | null> {
    const raw = await this.redis.get(this.stateKey(caseId));
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(
        { caseId, error: (error as Error).message },
        'Failed to parse conversation state; resetting',
      );
      await this.redis.del(this.stateKey(caseId));
      return null;
    }
  }

  async setState(
    caseId: string,
    patch: Record<string, any>,
  ): Promise<Record<string, any>> {
    const current = (await this.getState(caseId)) ?? {};
    const next = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await this.redis.set(
      this.stateKey(caseId),
      JSON.stringify(next),
      'EX',
      STATE_TTL_SECONDS,
    );
    return next;
  }

  async appendHistory(caseId: string, entry: Record<string, any>): Promise<void> {
    const serialized = JSON.stringify({
      ...entry,
      timestamp: entry.timestamp ?? new Date().toISOString(),
    });
    await this.redis.lpush(this.historyKey(caseId), serialized);
    await this.redis.ltrim(this.historyKey(caseId), 0, HISTORY_LIMIT - 1);
    await this.redis.expire(this.historyKey(caseId), STATE_TTL_SECONDS);
  }

  async getHistory<T = Record<string, any>>(
    caseId: string,
    limit = 10,
  ): Promise<T[]> {
    const serialized = await this.redis.lrange(
      this.historyKey(caseId),
      0,
      Math.max(0, limit - 1),
    );
    return serialized
      .map((item) => {
        try {
          return JSON.parse(item) as T;
        } catch (error) {
          this.logger.warn(
            { caseId, error: (error as Error).message },
            'Failed to parse history entry',
          );
          return null;
        }
      })
      .filter((item): item is T => item !== null)
      .reverse();
  }

  async listActiveCases(pattern = '*'): Promise<string[]> {
    const keys = await this.redis.keys(this.stateKey(pattern));
    return keys.map((key) => key.substring(key.lastIndexOf(':') + 1));
  }

  private stateKey(caseId: string) {
    return this.redisService.buildTenantKey(this.resolveTenant(), 'comms', 'state', caseId);
  }

  private historyKey(caseId: string) {
    return this.redisService.buildTenantKey(this.resolveTenant(), 'comms', 'history', caseId);
  }

  private resolveTenant(): string {
    try {
      return this.tenantContext.getTenantId();
    } catch {
      return 'system';
    }
  }
}
