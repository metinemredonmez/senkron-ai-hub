import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { TenantContextService } from '../context/tenant-context.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly tenantContext: TenantContextService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const tenantId = (() => {
      try {
        return this.tenantContext.getTenantId();
      } catch {
        return 'unknown';
      }
    })();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let details: Record<string, any> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();
      message =
        typeof responseBody === 'string'
          ? responseBody
          : (responseBody as any)?.message ?? message;
      if (typeof responseBody === 'object') {
        details = responseBody as Record<string, any>;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      details = { stack: exception.stack };
    }

    this.logger.error(
      {
        tenantId,
        status,
        message,
        path: request?.url,
        method: request?.method,
        details,
      },
      `Request failed: ${message}`,
    );

    response.status(status).json({
      statusCode: status,
      message,
      path: request?.url,
      timestamp: new Date().toISOString(),
      tenantId,
      details,
    });
  }
}
