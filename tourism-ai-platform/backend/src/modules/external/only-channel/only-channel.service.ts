import { HttpService } from '@nestjs/axios';
import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';
import { Redis } from 'ioredis';
import { RedisService } from '@/lib/nestjs-redis';
import { SendMessageDto } from './dto/send-message.dto';

export interface TokenResponse {
  tenant: string;
  token: string;
  expiresAt: string;
}

@Injectable()
export class OnlyChannelService {
  private readonly logger = new Logger(OnlyChannelService.name);
  private readonly baseUrl: string;
  private readonly accountToken?: string;
  private readonly ttlSeconds = 55 * 60;
  private readonly redis: Redis;
  private readonly redisService: RedisService;

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService,
    redisService: RedisService,
  ) {
    this.redisService = redisService;
    const configuredBase =
      this.configService.get<string>('ONLYCHANNEL_BASE_URL') ??
      process.env.ONLYCHANNEL_BASE_URL;
    this.baseUrl = configuredBase
      ? configuredBase.replace(/\/+$/, '')
      : 'http://localhost:3000';

    this.accountToken =
      this.configService.get<string>('ONLYCHANNEL_ACCOUNT_TOKEN') ??
      process.env.ONLYCHANNEL_ACCOUNT_TOKEN;

    this.redis = redisService.getClient();
  }

  async getTenantToken(
    tenantId: string,
    options?: { force?: boolean },
  ): Promise<TokenResponse> {
    if (!options?.force) {
      const cached = await this.getCachedToken(tenantId);
      if (cached) {
        return cached;
      }
    }
    return this.fetchAndCacheTenantToken(tenantId);
  }

  async listConversations(
    tenantId: string,
    query: Record<string, any> = {},
  ): Promise<unknown> {
    const token = await this.getTenantToken(tenantId);
    const url = this.resolveEndpoint('/conversations');
    try {
      const response = await lastValueFrom(
        this.http.get(url, {
          headers: this.tenantHeaders(token.token),
          params: query,
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to list OnlyChannel conversations for tenant ${tenantId}`,
        error instanceof Error ? error.stack : String(error),
      );
      this.handleAxiosError(error, 'Failed to fetch OnlyChannel conversations');
    }
  }

  async sendMessage(
    tenantId: string,
    payload: SendMessageDto,
  ): Promise<unknown> {
    const token = await this.getTenantToken(tenantId);
    const url = this.resolveEndpoint('/messages');
    try {
      const response = await lastValueFrom(
        this.http.post(url, payload, {
          headers: this.tenantHeaders(token.token),
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to send OnlyChannel message for tenant ${tenantId}`,
        error instanceof Error ? error.stack : String(error),
      );
      this.handleAxiosError(error, 'Failed to send OnlyChannel message');
    }
  }

  async getAccountAccessToken(
    tenantId: string,
    options?: { force?: boolean },
  ): Promise<TokenResponse> {
    return this.getTenantToken(tenantId, options);
  }

  private async getCachedToken(tenantId: string): Promise<TokenResponse | null> {
    const raw = await this.redis.get(this.cacheKey(tenantId));
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as TokenResponse;
    } catch (error) {
      this.logger.warn(
        `Invalid cached OnlyChannel token for ${tenantId}; purging entry`,
        error instanceof Error ? error.message : String(error),
      );
      await this.redis.del(this.cacheKey(tenantId));
      return null;
    }
  }

  private async fetchAndCacheTenantToken(tenantId: string): Promise<TokenResponse> {
    if (!this.accountToken) {
      throw new UnauthorizedException(
        'ONLYCHANNEL_ACCOUNT_TOKEN is required to fetch tenant tokens',
      );
    }

    const url = this.resolveEndpoint('/account/access-token');
    try {
      const response = await lastValueFrom(
        this.http.get(url, {
          headers: this.accountHeaders(),
          params: { tenantId },
        }),
      );
      const token = this.extractToken(response.data);
      if (!token) {
        throw new HttpException(
          'OnlyChannel token response missing token payload',
          HttpStatus.BAD_GATEWAY,
        );
      }
      const payload: TokenResponse = {
        tenant: tenantId,
        token,
        expiresAt: new Date(Date.now() + this.ttlSeconds * 1000).toISOString(),
      };
      await this.cacheToken(tenantId, payload);
      return payload;
    } catch (error) {
      this.logger.error(
        `Failed to fetch OnlyChannel token for tenant ${tenantId}`,
        error instanceof Error ? error.stack : String(error),
      );
      this.handleAxiosError(error, 'Failed to retrieve OnlyChannel access token');
    }
  }

  private async cacheToken(tenantId: string, payload: TokenResponse): Promise<void> {
    const key = this.cacheKey(tenantId);
    await this.redisService.setex(key, this.ttlSeconds, JSON.stringify(payload));
  }

  private cacheKey(tenantId: string): string {
    return this.redisService.buildTenantKey(tenantId, 'onlychannel', 'token');
  }

  private accountHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accountToken}`,
    };
  }

  private tenantHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private resolveEndpoint(path: string): string {
    if (!path.startsWith('/')) {
      return `${this.baseUrl}/${path}`;
    }
    return `${this.baseUrl}${path}`;
  }

  private extractToken(data: unknown): string | undefined {
    if (!data) {
      return undefined;
    }
    if (typeof data === 'string') {
      return data;
    }
    if (typeof data === 'object') {
      const payload = data as Record<string, unknown>;
      const direct =
        payload.accessToken ?? payload.access_token ?? payload.token ?? payload['access_token'];
      if (typeof direct === 'string') {
        return direct;
      }
      if (payload.data) {
        return this.extractToken(payload.data);
      }
    }
    return undefined;
  }

  private handleAxiosError(error: unknown, fallbackMessage: string): never {
    if (isAxiosError(error) && error.response) {
      const status = error.response.status ?? HttpStatus.BAD_GATEWAY;
      const message = error.response.data ?? fallbackMessage;
      throw new HttpException(message, status);
    }
    throw new HttpException(fallbackMessage, HttpStatus.BAD_GATEWAY);
  }
}
