import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { RedisService } from '@/lib/nestjs-redis';
import { TenantContextService } from '../context/tenant-context.service';
import { SKIP_RATE_LIMIT_METADATA_KEY } from '../decorators/skip-rate-limit.decorator';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  private readonly limit: number;
  private readonly windowSeconds: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly tenantContext: TenantContextService,
    private readonly reflector: Reflector,
  ) {
    const limit =
      this.configService.get<number>('RATE_LIMIT_PER_MINUTE') ?? 300;
    const window =
      this.configService.get<number>('RATE_LIMIT_WINDOW_SECONDS') ?? 60;
    this.limit = Number(limit) || 300;
    this.windowSeconds = Number(window) || 60;
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    if (!request || !response) {
      return next.handle();
    }

    if (!this.shouldRateLimit(context, request)) {
      return next.handle();
    }

    return from(this.checkLimit(request, response)).pipe(
      switchMap(() => next.handle()),
    );
  }

  private shouldRateLimit(context: ExecutionContext, request: Request): boolean {
    if (['HEAD', 'OPTIONS'].includes(request.method)) {
      return false;
    }
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_RATE_LIMIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) {
      return false;
    }
    const path = request.route?.path ?? request.originalUrl ?? request.url;
    return !path.includes('/health') && !path.includes('/metrics');
  }

  private async checkLimit(
    request: Request,
    response: Response,
  ): Promise<void> {
    const tenantId = this.resolveTenant(request);
    const route = (request.route?.path ?? request.originalUrl ?? request.url)
      .split('?')[0]
      .toLowerCase();
    const key = this.rateKey(tenantId, route);

    const client = this.redisService.getClient();
    const current = await client.incr(key);
    if (current === 1) {
      await client.expire(key, this.windowSeconds);
    }

    const remaining = Math.max(this.limit - current, 0);
    response.setHeader('X-RateLimit-Limit', this.limit.toString());
    response.setHeader('X-RateLimit-Remaining', remaining.toString());
    response.setHeader(
      'X-RateLimit-Reset',
      Math.floor(Date.now() / 1000 + this.windowSeconds).toString(),
    );

    if (current > this.limit) {
      throw new HttpException(
        `Tenant ${tenantId} exceeded rate limit for ${route}`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private resolveTenant(request: Request): string {
    const header = request.headers['x-tenant'];
    if (typeof header === 'string' && header.length) {
      return header.toLowerCase();
    }
    try {
      return this.tenantContext.getTenantId();
    } catch {
      return 'system';
    }
  }

  private rateKey(tenantId: string, route: string): string {
    const sanitizedRoute = route.replace(/[^a-z0-9:/_-]/gi, '_');
    return `rate:${tenantId}:${sanitizedRoute}`;
  }
}
