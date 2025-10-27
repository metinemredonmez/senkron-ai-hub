import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /\+?\d[\d\s-]{8,}/g;
const PHONE_MASK = '***phone***';
const EMAIL_MASK = '***email***';

function maskString(value: string): string {
  return value
    .replace(EMAIL_REGEX, EMAIL_MASK)
    .replace(PHONE_REGEX, PHONE_MASK);
}

function cloneAndMask<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return maskString(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneAndMask(item)) as unknown as T;
  }
  if (value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = cloneAndMask(val);
    }
    return result as T;
  }
  return value;
}

export function maskPhi<T>(value: T): T {
  return cloneAndMask(value);
}

@Injectable()
export class PhiRedactionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest<any>();
    const response = http.getResponse<any>();

    if (request) {
      request.__phiRedacted = {
        body: maskPhi(request.body),
        query: maskPhi(request.query),
        params: maskPhi(request.params),
      };
    }

    return next.handle().pipe(
      tap((data) => {
        if (response) {
          response.locals = response.locals ?? {};
          response.locals.__phiRedactedResponse = maskPhi(data);
        }
      }),
    );
  }
}
