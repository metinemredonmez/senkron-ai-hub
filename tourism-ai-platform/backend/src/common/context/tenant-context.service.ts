import { Injectable, Scope } from '@nestjs/common';
import crypto from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import { ConfigService } from '@nestjs/config';
import { REQUEST_ID_HEADER, TENANT_HEADER } from '../constants/app.constants';
import { RedisService } from '@/lib/nestjs-redis';

interface TenantContextState {
  tenantId: string;
  requestId: string;
  actorId?: string;
  token?: string;
}

@Injectable({ scope: Scope.DEFAULT })
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContextState>();
  private readonly tenantContextTtlSeconds: number;

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.tenantContextTtlSeconds =
      this.configService.get<number>('HUB_TENANT_CACHE_TTL_SECONDS') ??
      60 * 60 * 24;
  }

  runWithContext<T>(context: TenantContextState, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  async runWithTenant<T>(
    tenantId: string,
    callback: () => Promise<T>,
    options?: { actorId?: string; token?: string },
  ): Promise<T> {
    const context: TenantContextState = {
      tenantId,
      requestId: crypto.randomUUID(),
      actorId: options?.actorId,
      token: options?.token,
    };
    return this.storage.run(context, async () => {
      await this.cacheTenantContext(tenantId, {
        actorId: options?.actorId,
        token: options?.token,
      });
      return callback();
    });
  }

  setTenant(
    tenantId: string,
    requestId: string,
    actorId?: string,
    token?: string,
  ): void {
    const current = this.storage.getStore();
    if (current) {
      current.tenantId = tenantId;
      current.requestId = requestId;
      current.actorId = actorId ?? current.actorId;
      current.token = token ?? current.token;
    } else {
      this.storage.enterWith({ tenantId, requestId, actorId, token });
    }
    void this.cacheTenantContext(tenantId, { actorId, token });
  }

  getTenantId(): string {
    const store = this.storage.getStore();
    if (!store?.tenantId) {
      throw new Error(
        'Tenant context missing. Ensure X-Tenant header is provided and TenantContextInterceptor is registered.',
      );
    }
    return store.tenantId;
  }

  getRequestId(): string {
    const store = this.storage.getStore();
    return store?.requestId ?? 'unknown';
  }

  getActorId(): string | undefined {
    return this.storage.getStore()?.actorId;
  }

  getToken(): string | undefined {
    return this.storage.getStore()?.token;
  }

  async extractContextFromRequest(request: {
    headers: Record<string, string | string[]>;
    user?: { sub?: string; id?: string };
    tenantId?: string;
  }): Promise<TenantContextState> {
    const tenantHeader =
      (await this.resolveTenantIdFromHeaders(request)) ?? request.tenantId;
    if (!tenantHeader) {
      throw new Error(`Missing required tenant identifier (${TENANT_HEADER} header or auth token)`);
    }
    const requestId =
      (request.headers[REQUEST_ID_HEADER] as string) ??
      crypto.randomUUID?.() ??
      `${Date.now()}-${Math.random()}`;
    const actorId = request.user?.sub ?? request.user?.id;
    return {
      tenantId: tenantHeader,
      requestId,
      actorId,
      token: this.extractOnlyChannelToken(request.headers),
    };
  }

  async resolveTenantIdFromHeaders(request: {
    headers: Record<string, string | string[]>;
    user?: { tenantId?: string; tenant?: string; sub?: string };
  }): Promise<string | undefined> {
    const tenantHeader =
      (request.headers[TENANT_HEADER] as string) ??
      (request.headers[TENANT_HEADER?.toUpperCase?.()] as string);
    if (tenantHeader) {
      return tenantHeader;
    }

    const token = this.extractOnlyChannelToken(request.headers);
    if (token) {
      return this.resolveTenantByOnlyChannelToken(token);
    }

    const jwtTenant =
      (request.user as { tenantId?: string; tenant?: string })?.tenantId ??
      (request.user as { tenantId?: string; tenant?: string })?.tenant;
    return jwtTenant ?? undefined;
  }

  private extractOnlyChannelToken(
    headers: Record<string, string | string[]>,
  ): string | undefined {
    const auth =
      (headers['authorization'] as string) ??
      (headers['Authorization' as keyof typeof headers] as string);
    if (typeof auth === 'string') {
      const token = auth.startsWith('Bearer ') ? auth.substring(7) : auth;
      if (token?.startsWith('ak_')) {
        return token;
      }
    }
    const direct =
      (headers['x-onlychannel-token'] as string) ??
      (headers['X-OnlyChannel-Token' as keyof typeof headers] as string);
    if (typeof direct === 'string' && direct.startsWith('ak_')) {
      return direct;
    }
    return undefined;
  }

  async resolveTenantByOnlyChannelToken(token: string): Promise<string | undefined> {
    if (!token?.startsWith('ak_')) {
      return undefined;
    }
    const cached = await this.redis.get(`token:onlychannel:${token}`);
    if (typeof cached === 'string' && cached.length > 0) {
      return cached;
    }
    return this.parseTenantFromOnlyChannelToken(token);
  }

  private async cacheTenantContext(
    tenantId: string,
    context: { actorId?: string; token?: string },
  ): Promise<void> {
    const ttl = this.tenantContextTtlSeconds;
    const key = `${tenantId}:hub:context`;
    const payload = {
      tenantId,
      actorId: context.actorId,
      token: context.token,
      lastActivity: new Date().toISOString(),
    };
    await this.redis.set(key, JSON.stringify(payload), ttl);
    if (context.token?.startsWith?.('ak_')) {
      await this.redis.set(
        `${tenantId}:onlychannel:token`,
        context.token,
        ttl,
      );
      await this.redis.set(
        `token:onlychannel:${context.token}`,
        tenantId,
        ttl,
      );
    }
  }

  private parseTenantFromOnlyChannelToken(token: string): string | undefined {
    if (!token?.startsWith('ak_')) {
      return undefined;
    }
    const [_prefix, tenant, ...rest] = token.split('_');
    if (tenant && rest.length) {
      return tenant;
    }
    return undefined;
  }
}
