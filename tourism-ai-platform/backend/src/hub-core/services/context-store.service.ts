import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { RedisService } from '@/lib/nestjs-redis';

interface TenantContextPayload {
  tenant: Record<string, unknown>;
  updatedAt: string;
}

interface SessionContextPayload {
  session: Record<string, unknown>;
  updatedAt: string;
}

@Injectable()
export class ContextStoreService {
  private readonly logger = new Logger(ContextStoreService.name);
  private readonly redis: Redis;
  private static readonly TENANT_TTL_SECONDS = 60 * 60 * 24; // 24 hours

  constructor(private readonly redisService: RedisService) {
    this.redis = this.redisService.getClient();
  }

  private tenantKey(tenantId: string): string {
    return `${tenantId}:hub:context`;
  }

  private sessionKey(tenantId: string, sessionId: string): string {
    return `${tenantId}:hub:session:${sessionId}`;
  }

  async getTenantContext<T = Record<string, unknown>>(tenantId: string): Promise<T | null> {
    const primaryKey = this.tenantKey(tenantId);
    const legacyKey = `hub:context:${tenantId}`;
    const raw =
      (await this.redis.get(primaryKey)) ??
      (legacyKey !== primaryKey ? await this.redis.get(legacyKey) : null);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as TenantContextPayload & { value?: T };
      return ((parsed.value as T) ?? (parsed.tenant as T)) ?? null;
    } catch (error) {
      this.logger.warn(`Failed to parse tenant context for ${tenantId}`, error as Error);
      return null;
    }
  }

  async setTenantContext(tenantId: string, context: Record<string, unknown>, ttlSeconds = ContextStoreService.TENANT_TTL_SECONDS): Promise<void> {
    const payload: TenantContextPayload & { value: Record<string, unknown> } = {
      tenant: context,
      value: context,
      updatedAt: new Date().toISOString(),
    };
    await this.redis.set(this.tenantKey(tenantId), JSON.stringify(payload), 'EX', ttlSeconds);
  }

  async getSessionContext<T = Record<string, unknown>>(tenantId: string, sessionId: string): Promise<T | null> {
    const primaryKey = this.sessionKey(tenantId, sessionId);
    const legacyKey = `hub:context:${tenantId}:session:${sessionId}`;
    const raw =
      (await this.redis.get(primaryKey)) ??
      (legacyKey !== primaryKey ? await this.redis.get(legacyKey) : null);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as SessionContextPayload & { value?: T };
      return ((parsed.value as T) ?? (parsed.session as T)) ?? null;
    } catch (error) {
      this.logger.warn(
        `Failed to parse session context for ${tenantId}/${sessionId}`,
        error as Error,
      );
      return null;
    }
  }

  async setSessionContext(
    tenantId: string,
    sessionId: string,
    context: Record<string, unknown>,
    ttlSeconds = ContextStoreService.TENANT_TTL_SECONDS,
  ): Promise<void> {
    const payload: SessionContextPayload & { value: Record<string, unknown> } = {
      session: context,
      value: context,
      updatedAt: new Date().toISOString(),
    };
    await this.redis.set(this.sessionKey(tenantId, sessionId), JSON.stringify(payload), 'EX', ttlSeconds);
  }

  async clearSessionContext(tenantId: string, sessionId: string): Promise<void> {
    await this.redis.del(this.sessionKey(tenantId, sessionId), `hub:context:${tenantId}:session:${sessionId}`);
  }
}
