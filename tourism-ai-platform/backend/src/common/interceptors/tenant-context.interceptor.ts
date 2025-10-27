import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import crypto from 'crypto';
import { Observable } from 'rxjs';
import { TenantContextService } from '../context/tenant-context.service';
import { TENANT_HEADER, REQUEST_ID_HEADER } from '../constants/app.constants';
import { context as otelContext, trace } from '@opentelemetry/api';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const http = context.switchToHttp();
    const request = http.getRequest();

    const path: string =
      request.path ?? request.originalUrl ?? request.url ?? '';
    const lowerPath = typeof path === 'string' ? path.toLowerCase() : '';
    const isTenantOptional =
      lowerPath === '/health' ||
      lowerPath.startsWith('/api/health') ||
      lowerPath === '/docs' ||
      lowerPath === '/docs-json' ||
      lowerPath === '/metrics' ||
      lowerPath.startsWith('/metrics?') ||
      lowerPath.startsWith('/api/docs') ||
      lowerPath.startsWith('/api/docs-json') ||
      lowerPath.startsWith('/api/webhooks') ||
      lowerPath.startsWith('/webhooks');

    if (isTenantOptional) {
      const requestId =
        request.headers[REQUEST_ID_HEADER] ??
        request.headers[REQUEST_ID_HEADER?.toUpperCase?.()] ??
        crypto.randomUUID();
      const tenantId = 'system';
      request.tenantId = tenantId;
      request.requestId = requestId;
      this.tenantContext.setTenant(
        tenantId,
        typeof requestId === 'string' ? requestId : String(requestId),
      );
      this.annotateActiveSpan(
        tenantId,
        typeof requestId === 'string' ? requestId : String(requestId),
      );

      return this.tenantContext.runWithContext<Observable<any>>(
        {
          tenantId,
          requestId:
            typeof requestId === 'string' ? requestId : String(requestId),
          actorId: undefined,
        },
        () => next.handle(),
      );
    }

    const { tenantId, token } = await this.resolveTenant(request);
    if (!tenantId) {
      throw new BadRequestException(
        `Missing tenant context. Supply ${TENANT_HEADER} header, OnlyChannel token, or tenant-bound JWT.`,
      );
    }

    const requestId =
      request.headers[REQUEST_ID_HEADER] ??
      request.headers[REQUEST_ID_HEADER?.toUpperCase?.()] ??
      crypto.randomUUID();
    request.tenantId = tenantId;
    request.requestId = requestId;

    this.tenantContext.setTenant(
      tenantId,
      typeof requestId === 'string' ? requestId : String(requestId),
      request.user?.sub ?? request.user?.id,
      token,
    );
    this.annotateActiveSpan(
      tenantId,
      typeof requestId === 'string' ? requestId : String(requestId),
    );

    return this.tenantContext.runWithContext<Observable<any>>(
      {
        tenantId,
        requestId: typeof requestId === 'string' ? requestId : String(requestId),
        actorId: request.user?.sub ?? request.user?.id,
        token,
      },
      () => next.handle(),
    );
  }

  private annotateActiveSpan(tenantId: string, requestId: string): void {
    const span = trace.getSpan(otelContext.active());
    if (span) {
      span.setAttribute('tenant_id', tenantId);
      span.setAttribute('request_id', requestId);
    }
  }

  private async resolveTenant(request: any): Promise<{ tenantId?: string; token?: string }> {
    const headerValue = this.extractHeaderTenant(request);
    const token = this.extractOnlyChannelToken(request);
    const tenantFromToken = token
      ? await this.tenantContext.resolveTenantByOnlyChannelToken(token)
      : undefined;
    const jwtTenant =
      request.user?.tenantId ??
      request.user?.tenant?.id ??
      request.user?.tenant;

    return {
      tenantId: headerValue ?? tenantFromToken ?? jwtTenant,
      token,
    };
  }

  private extractHeaderTenant(request: any): string | undefined {
    const header = request.headers?.[TENANT_HEADER];
    if (typeof header === 'string') {
      return header;
    }
    if (Array.isArray(header) && header.length > 0) {
      return header[0];
    }
    const upper = request.headers?.[TENANT_HEADER.toUpperCase?.()];
    if (typeof upper === 'string') {
      return upper;
    }
    return undefined;
  }

  private extractOnlyChannelToken(request: any): string | undefined {
    const authHeader: string | undefined =
      request.headers?.authorization ?? request.headers?.Authorization;
    if (typeof authHeader === 'string') {
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;
      if (token?.startsWith('ak_')) {
        return token;
      }
    }
    const altHeader: string | undefined =
      request.headers?.['x-onlychannel-token'] ??
      request.headers?.['X-OnlyChannel-Token'];
    if (typeof altHeader === 'string' && altHeader.startsWith('ak_')) {
      return altHeader;
    }
    return undefined;
  }
}
