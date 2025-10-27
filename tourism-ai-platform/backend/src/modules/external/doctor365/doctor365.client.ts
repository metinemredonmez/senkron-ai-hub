import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError, AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Counter, Histogram, register } from 'prom-client';
import crypto from 'crypto';
import { PinoLogger } from 'nestjs-pino';
import { Redis } from 'ioredis';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { RedisService } from '@/lib/nestjs-redis';
import {
  REQUEST_ID_HEADER,
  REDACTION_MASK,
  TENANT_HEADER,
} from '../../../common/constants/app.constants';
import { IntegrationsConfig } from '../../../config/integrations.config';
import {
  Doctor365Appointment,
  Doctor365AuthResponse,
  Doctor365ListResponse,
  Doctor365Patient,
  Doctor365Provider,
} from './types';

interface RequestOptions extends AxiosRequestConfig {
  method: Method;
  url: string;
  spanName?: string;
  retryable?: boolean;
}

const tracer = trace.getTracer('doctor365');

const getOrCreateHistogram = (
  name: string,
  help: string,
  labelNames: string[],
  buckets: number[],
): Histogram<string> => {
  const existing = register.getSingleMetric(name) as Histogram<string> | null;
  if (existing) {
    return existing;
  }
  return new Histogram({
    name,
    help,
    labelNames,
    buckets,
  });
};

const getOrCreateCounter = (
  name: string,
  help: string,
  labelNames: string[],
): Counter<string> => {
  const existing = register.getSingleMetric(name) as Counter<string> | null;
  if (existing) {
    return existing;
  }
  return new Counter({
    name,
    help,
    labelNames,
  });
};

const requestDurationMetric = getOrCreateHistogram(
  'doctor365_http_request_duration_ms',
  'Duration of Doktor365 HTTP proxy calls (ms)',
  ['method', 'endpoint', 'status', 'tenant'],
  [50, 100, 200, 400, 800, 1600, 3200, 6400],
);

const requestFailureMetric = getOrCreateCounter(
  'doctor365_http_request_failures_total',
  'Count of failed Doktor365 HTTP requests',
  ['method', 'endpoint', 'status', 'tenant'],
);

@Injectable()
export class Doctor365Client {
  private readonly redis: Redis;

  private failureCount = 0;
  private circuitOpenUntil?: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly tenantContext: TenantContextService,
    private readonly logger: PinoLogger,
  ) {
    this.redis = this.redisService.getClient();
    this.logger.setContext(Doctor365Client.name);
  }

  async fetchProviders(
    query: Record<string, unknown>,
  ): Promise<Doctor365Provider[]> {
    const response = await this.request<Doctor365ListResponse<Doctor365Provider>>({
      method: 'GET',
      url: '/providers',
      params: query,
      spanName: 'doctor365.fetchProviders',
    });

    if (Array.isArray(response?.data)) {
      return response.data.map((provider) => this.sanitizeProvider(provider));
    }
    return [];
  }

  async fetchPatient(doktor365Id: string): Promise<Doctor365Patient> {
    const response = await this.request<{ data: Doctor365Patient }>({
      method: 'GET',
      url: `/patients/${encodeURIComponent(doktor365Id)}`,
      spanName: 'doctor365.fetchPatient',
    });
    return this.sanitizePatient(response.data);
  }

  async upsertPatient(
    payload: Record<string, unknown>,
  ): Promise<Doctor365Patient> {
    const response = await this.request<{ data: Doctor365Patient }>({
      method: 'POST',
      url: '/patients/sync',
      data: payload,
      spanName: 'doctor365.upsertPatient',
    });
    return this.sanitizePatient(response.data);
  }

  async createAppointment(
    payload: Record<string, unknown>,
  ): Promise<Doctor365Appointment> {
    const response = await this.request<{ data: Doctor365Appointment }>({
      method: 'POST',
      url: '/appointments',
      data: payload,
      spanName: 'doctor365.createAppointment',
    });
    return this.sanitizeAppointment(response.data);
  }

  async createPatientDeal(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await this.request<{ data: Record<string, unknown> }>({
      method: 'POST',
      url: '/patients/deals',
      data: payload,
      spanName: 'doctor365.createPatientDeal',
    });
    return response.data;
  }

  async sendFlightData(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await this.request<{ data: Record<string, unknown> }>({
      method: 'POST',
      url: '/patients/ai/send-flight-data',
      data: payload,
      spanName: 'doctor365.sendFlightData',
    });
    return response.data;
  }

  async createAppointmentDeal(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await this.request<{ data: Record<string, unknown> }>({
      method: 'POST',
      url: '/appointments/deals',
      data: payload,
      spanName: 'doctor365.createAppointmentDeal',
    });
    return response.data;
  }

  private async request<T>(options: RequestOptions): Promise<T> {
    const tenantId = this.tenantContext.getTenantId();
    const tenantLabel = this.hashTenant(tenantId);

    if (this.circuitOpenUntil && Date.now() < this.circuitOpenUntil) {
      throw new ServiceUnavailableException(
        'Doktor365 integration circuit breaker open',
      );
    }

    const maxAttempts = 3;
    let attempt = 0;
    let lastError: unknown;
    let forceTokenRefresh = false;

    while (attempt < maxAttempts) {
      attempt += 1;
      const accessToken = await this.getAccessToken(forceTokenRefresh);

      const span = tracer.startSpan(options.spanName ?? 'doctor365.request', {
        attributes: {
          'doctor365.method': options.method,
          'doctor365.url': options.url,
          'doctor365.attempt': attempt,
          'doctor365.tenant': tenantLabel,
        },
      });

      const start = Date.now();
      try {
        const response = await this.dispatch<T>({
          ...options,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            [TENANT_HEADER]: tenantId,
            [REQUEST_ID_HEADER]: this.tenantContext.getRequestId(),
            ...options.headers,
          },
        });
        const duration = Date.now() - start;
        const status = (response as AxiosResponse)?.status ?? 200;

        requestDurationMetric.observe(
          {
            method: options.method,
            endpoint: options.url,
            status: String(status),
            tenant: tenantLabel,
          },
          duration,
        );
        this.failureCount = 0;
        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttribute('http.status_code', status);
        span.end();

        return (response as AxiosResponse<T>).data;
      } catch (error) {
        lastError = error;
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status ?? 'ERR';
        const duration = Date.now() - start;
        requestDurationMetric.observe(
          {
            method: options.method,
            endpoint: options.url,
            status: String(status),
            tenant: tenantLabel,
          },
          duration,
        );
        requestFailureMetric.inc({
          method: options.method,
          endpoint: options.url,
          status: String(status),
          tenant: tenantLabel,
        });

        span.recordException(axiosError);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: this.extractErrorMessage(axiosError),
        });
        span.end();

        const shouldRetry = this.shouldRetry(axiosError) && attempt < maxAttempts;
        this.failureCount += 1;
        if (axiosError.response?.status === 401 && !forceTokenRefresh) {
          forceTokenRefresh = true;
          await this.purgeTokenCache();
        }

        this.logger.warn(
          {
            attempt,
            method: options.method,
            endpoint: options.url,
            status,
            retrying: shouldRetry,
          },
          'Doktor365 request failed',
        );

        if (!shouldRetry) {
          break;
        }

        const backoffMs = Math.min(5000, 200 * Math.pow(2, attempt - 1));
        await this.sleep(backoffMs);
      }
    }

    this.openCircuitIfThresholdExceeded();
    throw new ServiceUnavailableException(
      `Doktor365 request failed after ${maxAttempts} attempts: ${this.extractErrorMessage(
        lastError,
      )}`,
    );
  }

  private async dispatch<T>(
    options: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return firstValueFrom(
      this.httpService.request<T>({
        ...options,
      }),
    );
  }

  private shouldRetry(error: AxiosError): boolean {
    if (error.code === 'ECONNABORTED' || error.code === 'ECONNRESET') {
      return true;
    }
    const status = error.response?.status ?? 0;
    return status === 429 || status >= 500;
  }

  private async getAccessToken(forceRefresh = false): Promise<string> {
    const tenantId = this.tenantContext.getTenantId();
    const tenantLabel = this.hashTenant(tenantId);
    const cacheKey = this.tokenCacheKey(tenantId);

    if (!forceRefresh) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const integrations =
      this.configService.get<IntegrationsConfig>('integrations');
    const config = integrations?.doktor365;
    if (!config) {
      throw new ServiceUnavailableException(
        'Doktor365 configuration is not available',
      );
    }

    const refreshToken = await this.redis.get(
      this.refreshTokenCacheKey(tenantId),
    );
    if (refreshToken) {
      try {
        return await this.refreshToken(tenantId, refreshToken, config);
      } catch (error) {
        this.logger.warn(
          {
            tenant: tenantLabel,
            error: this.extractErrorMessage(error),
          },
          'Doktor365 refresh token flow failed; falling back to client credentials',
        );
        await this.redis.del(this.refreshTokenCacheKey(tenantId));
      }
    }

    return this.acquireClientCredentialsToken(tenantId, config, tenantLabel);
  }

  private async purgeTokenCache(options?: { includeRefresh?: boolean }): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    const keys = [this.tokenCacheKey(tenantId)];
    if (options?.includeRefresh) {
      keys.push(this.refreshTokenCacheKey(tenantId));
    }
    await this.redis.del(...keys);
  }

  private tokenCacheKey(tenantId: string): string {
    return `${tenantId}:doktor365:token`;
  }

  private refreshTokenCacheKey(tenantId: string): string {
    return `${tenantId}:doktor365:refresh-token`;
  }

  private async acquireClientCredentialsToken(
    tenantId: string,
    config: IntegrationsConfig['doktor365'],
    tenantLabel: string,
  ): Promise<string> {
    const payload = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: config.scope,
    });
    if (config.audience) {
      payload.append('audience', config.audience);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<Doctor365AuthResponse>(config.authUrl, payload, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
      return this.storeTokens(tenantId, response.data, config);
    } catch (error) {
      this.logger.error(
        {
          tenant: tenantLabel,
          error: this.extractErrorMessage(error),
        },
        'Failed to acquire Doktor365 token via client credentials',
      );
      throw new ServiceUnavailableException(
        'Failed to authenticate with Doktor365',
      );
    }
  }

  private async refreshToken(
    tenantId: string,
    refreshToken: string,
    config: IntegrationsConfig['doktor365'],
  ): Promise<string> {
    const payload = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    });
    if (config.scope) {
      payload.append('scope', config.scope);
    }
    if (config.audience) {
      payload.append('audience', config.audience);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<Doctor365AuthResponse>(config.authUrl, payload, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
      return this.storeTokens(tenantId, response.data, config);
    } catch (error) {
      this.logger.warn(
        {
          tenant: this.hashTenant(tenantId),
          error: this.extractErrorMessage(error),
        },
        'Doktor365 refresh token exchange failed',
      );
      throw error;
    }
  }

  private async storeTokens(
    tenantId: string,
    tokenResponse: Doctor365AuthResponse,
    config: IntegrationsConfig['doktor365'],
  ): Promise<string> {
    const accessToken = tokenResponse.access_token;
    const expiresIn = tokenResponse.expires_in ?? 3600;
    const ttl = Math.max(60, expiresIn - (config.tokenTtlBufferSec ?? 30));
    await this.redis.set(this.tokenCacheKey(tenantId), accessToken, 'EX', ttl);

    if (tokenResponse.refresh_token) {
      await this.redis.set(
        this.refreshTokenCacheKey(tenantId),
        tokenResponse.refresh_token,
        'EX',
        55 * 60,
      );
    } else {
      await this.redis.del(this.refreshTokenCacheKey(tenantId));
    }

    return accessToken;
  }

  private hashTenant(tenantId: string): string {
    return crypto.createHash('sha256').update(tenantId).digest('hex').slice(0, 12);
  }

  private sanitizeProvider(provider: Doctor365Provider): Doctor365Provider {
    return {
      id: provider.id,
      name: provider.name,
      specialty: provider.specialty,
      location: provider.location,
      languageSupport: provider.languageSupport,
      accreditation: provider.accreditation,
      rating: provider.rating,
    };
  }

  private sanitizePatient(patient: Doctor365Patient): Doctor365Patient {
    return {
      id: patient.id,
      externalId: patient.externalId,
      status: patient.status,
      updatedAt: patient.updatedAt,
      lastSyncedAt: patient.lastSyncedAt,
      allergies: patient.allergies,
      bloodType: patient.bloodType,
      labResults: patient.labResults,
    };
  }

  private sanitizeAppointment(
    appointment: Doctor365Appointment,
  ): Doctor365Appointment {
    return {
      id: appointment.id,
      patientId: appointment.patientId,
      providerId: appointment.providerId,
      scheduledAt: appointment.scheduledAt,
      status: appointment.status,
      location: appointment.location,
    };
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
      return (
        (error.response?.data as any)?.message ??
        error.response?.statusText ??
        error.message
      );
    }
    if (error instanceof Error) {
      return error.message;
    }
    return REDACTION_MASK;
  }

  private openCircuitIfThresholdExceeded() {
    const integrations =
      this.configService.get<IntegrationsConfig>('integrations');
    const config = integrations?.doktor365;
    if (!config) {
      return;
    }

    if (this.failureCount >= config.circuitBreaker.failureThreshold) {
      const coolDownUntil = Date.now() + config.circuitBreaker.coolDownMs;
      this.circuitOpenUntil = coolDownUntil;
      this.logger.error(
        {
          failureCount: this.failureCount,
          coolDownMs: config.circuitBreaker.coolDownMs,
        },
        'Opening Doktor365 circuit breaker',
      );
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
