import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { maskPhi } from './phi_redaction.interceptor';
import { RequestUser } from '../decorators/current-user.decorator';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(LoggingInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    if (!request || !response) {
      return next.handle();
    }

    const start = process.hrtime.bigint();
    const correlationId =
      (request.headers['x-request-id'] as string | undefined) ?? randomUUID();
    response.setHeader('X-Request-Id', correlationId);
    const user = request.user as RequestUser | undefined;

    const phiContext = (request as any)?.__phiRedacted ?? {};
    const redactedBody = phiContext.body ?? maskPhi(request.body);
    const redactedQuery = phiContext.query ?? maskPhi(request.query);

    this.logger.info(
      {
        correlationId,
        method: request.method,
        url: request.originalUrl ?? request.url,
        tenant: request.headers['x-tenant'] ?? 'system',
        userId: user?.id,
        body: redactedBody,
        query: redactedQuery,
      },
      'HTTP request received',
    );

    return next.handle().pipe(
      tap((data) => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        const responsePayload =
          response.locals?.__phiRedactedResponse ?? maskPhi(data);

        this.logger.info(
          {
            correlationId,
            statusCode: response.statusCode,
            durationMs: Math.round(durationMs * 100) / 100,
            response: responsePayload,
          },
          'HTTP request completed',
        );
      }),
      catchError((error) => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        this.logger.error(
          {
            correlationId,
            statusCode: response.statusCode ?? 500,
            durationMs: Math.round(durationMs * 100) / 100,
            error: {
              name: error.name,
              message: error.message,
            },
          },
          'HTTP request failed',
        );
        return throwError(() => error);
      }),
    );
  }
}
