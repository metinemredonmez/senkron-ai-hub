import {
  BadRequestException,
  ConflictException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IdempotencyService } from '../services/idempotency.service';

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (!['POST', 'PATCH'].includes(req.method.toUpperCase())) {
      return next();
    }

    if (this.shouldSkip(req)) {
      return next();
    }

    const key =
      req.header('x-idempotency-key') ?? req.header('idempotency-key');
    if (!key) {
      throw new BadRequestException('X-Idempotency-Key header is required');
    }

    const tenantId = (req.header('x-tenant') ?? 'system').toString();
    const composedKey = `${tenantId}:${key}`;
    const acquired = await this.idempotencyService.acquire(composedKey, 60 * 5);
    if (!acquired) {
      throw new ConflictException('Duplicate request detected');
    }

    res.on('finish', () => {
      if (res.statusCode >= 400) {
        this.idempotencyService.release(composedKey).catch(() => undefined);
      }
    });

    return next();
  }

  private shouldSkip(req: Request): boolean {
    const path = (req.originalUrl ?? req.url ?? '').toLowerCase();
    return (
      path.includes('/health') ||
      path.includes('/metrics') ||
      path.startsWith('/api/webhooks') ||
      path.startsWith('/webhooks')
    );
  }
}
