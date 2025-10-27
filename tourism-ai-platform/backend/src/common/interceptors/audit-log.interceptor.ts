import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuditLogService } from '../services/audit-log.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const start = Date.now();

    if (this.shouldSkipLogging(request)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (responseBody) => {
        await this.auditLogService.record({
          action: `${request.method} ${request.route?.path ?? request.url}`,
          resource: request.route?.path ?? request.url,
          resourceId: responseBody?.id,
          details: {
            statusCode: http.getResponse()?.statusCode ?? 200,
            durationMs: Date.now() - start,
          },
        });
      }),
      catchError((error) => {
        this.auditLogService
          .record({
            action: `${request.method} ${request.route?.path ?? request.url}`,
            resource: request.route?.path ?? request.url,
            status: 'ERROR',
            details: {
              message: error.message,
              stack: error.stack,
            },
          })
          .catch(() => undefined);
        return throwError(() => error);
      }),
    );
  }

  private shouldSkipLogging(request: any): boolean {
    const method = String(request?.method ?? 'GET').toUpperCase();
    if (method === 'OPTIONS' || method === 'HEAD') {
      return true;
    }

    const path: string =
      request.route?.path ?? request.path ?? request.originalUrl ?? '';
    const lowerPath = path.toLowerCase();

    // Skip logging for health/metrics and other system endpoints that fire frequently
    return (
      lowerPath === '/metrics' ||
      lowerPath.startsWith('/metrics?') ||
      lowerPath === '/health' ||
      lowerPath.startsWith('/api/health')
    );
  }
}
