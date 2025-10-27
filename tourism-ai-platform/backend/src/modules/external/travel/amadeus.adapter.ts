import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import crypto from 'crypto';
import { Histogram, register } from 'prom-client';
import { RedisService } from '@/lib/nestjs-redis';
import { PinoLogger } from 'nestjs-pino';

interface AmadeusTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface RequestOptions extends AxiosRequestConfig {
  spanName: string;
  requiresAuth?: boolean;
}

const tracer = trace.getTracer('travel-integrations');

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

const integrationDurationMetric = getOrCreateHistogram(
  'integration_request_duration_seconds',
  'Integration request duration in seconds',
  ['provider', 'status'],
  [0.1, 0.3, 0.5, 1, 2, 5, 10],
);

@Injectable()
export class AmadeusAdapter {
  private readonly axios: AxiosInstance;
  private readonly redis: Redis;
  private readonly clientId: string;
  private readonly clientSecret: string;

  private consecutiveFailures = 0;
  private circuitOpenUntil?: number;

  private readonly maxFailures = 5;
  private readonly openDurationMs = 30_000;

  constructor(
    configService: ConfigService,
    redisService: RedisService,
    private readonly logger: PinoLogger,
  ) {
    const baseURL =
      configService.get<string>('AMADEUS_BASE_URL') ??
      'https://test.api.amadeus.com';

    this.clientId = configService.get<string>('AMADEUS_CLIENT_ID') ?? '';
    this.clientSecret =
      configService.get<string>('AMADEUS_CLIENT_SECRET') ?? '';

    this.redis = redisService.getClient();
    this.logger.setContext(AmadeusAdapter.name);

    this.axios = axios.create({
      baseURL,
      timeout: 10_000,
    });

    axiosRetry(this.axios, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        const status = error.response?.status;
        if (!status) {
          return true;
        }
        return status >= 500 || status === 429;
      },
    });
  }

  async getAccessToken(forceRefresh = false): Promise<string> {
    const cacheKey = 'amadeus:token';
    if (!forceRefresh) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const data = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await this.request<AmadeusTokenResponse>({
      method: 'POST',
      url: '/v1/security/oauth2/token',
      data,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      requiresAuth: false,
      spanName: 'amadeus.token',
    });

    if (!response?.access_token) {
      throw new ServiceUnavailableException('Failed to obtain Amadeus token');
    }

    // Cache for 55 minutes (tokens usually 1h)
    await this.redis.set(cacheKey, response.access_token, 'EX', 55 * 60);

    return response.access_token;
  }

  async searchFlights(params: Record<string, any>): Promise<any> {
    return this.request<any>({
      method: 'GET',
      url: '/v2/shopping/flight-offers',
      params,
      spanName: 'amadeus.searchFlights',
    });
  }

  async getFlightOffer(offerId: string): Promise<any> {
    return this.request<any>({
      method: 'GET',
      url: `/v2/shopping/flight-offers/${encodeURIComponent(offerId)}`,
      spanName: 'amadeus.getFlightOffer',
    });
  }

  async searchHotels(params: Record<string, any>): Promise<any> {
    return this.request<any>({
      method: 'GET',
      url: '/v2/shopping/hotel-offers',
      params,
      spanName: 'amadeus.searchHotels',
    });
  }

  async bookItinerary(payload: Record<string, any>): Promise<any> {
    return this.request<any>({
      method: 'POST',
      url: '/v1/booking/flight-orders',
      data: payload,
      spanName: 'amadeus.bookItinerary',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private isCircuitOpen(): boolean {
    if (!this.circuitOpenUntil) {
      return false;
    }
    if (Date.now() > this.circuitOpenUntil) {
      this.circuitOpenUntil = undefined;
      this.consecutiveFailures = 0;
      return false;
    }
    return true;
  }

  private openCircuit(): void {
    this.circuitOpenUntil = Date.now() + this.openDurationMs;
    this.logger.warn(
      `Amadeus circuit opened for ${this.openDurationMs / 1000}s due to consecutive failures`,
    );
  }

  private async request<T>(options: RequestOptions): Promise<T> {
    if (this.isCircuitOpen()) {
      throw new ServiceUnavailableException(
        'Amadeus circuit breaker is open. Try again later.',
      );
    }

    const span = tracer.startSpan(options.spanName, {
      attributes: {
        integration_call: 'amadeus',
        'http.method': options.method ?? 'GET',
        'http.url': options.url ?? '',
      },
    });

    const startTime = process.hrtime.bigint();
    const providerLabel = 'amadeus';
    try {
      let headers = options.headers ?? {};
      if (options.requiresAuth !== false) {
        const token = await this.getAccessToken();
        headers = {
          ...headers,
          Authorization: `Bearer ${token}`,
        };
      }

      const response: AxiosResponse<T> = await this.axios.request<T>({
        ...options,
        headers,
      });

      const durationSec =
        Number(process.hrtime.bigint() - startTime) / 1_000_000_000;
      integrationDurationMetric.observe(
        { provider: providerLabel, status: String(response.status) },
        durationSec,
      );

      this.consecutiveFailures = 0;
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status ?? 0;

      const durationSec =
        Number(process.hrtime.bigint() - startTime) / 1_000_000_000;
      integrationDurationMetric.observe(
        { provider: providerLabel, status: String(status || 0) },
        durationSec,
      );

      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= this.maxFailures) {
        this.openCircuit();
      }

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: axiosError.message,
      });
      span.recordException(error);
      span.end();

      // If unauthorized, force token refresh on next attempt
      if (status === 401) {
        const cacheKey = 'amadeus:token';
        await this.redis.del(cacheKey);
      }

      if (
        axiosError.response?.data &&
        typeof axiosError.response.data === 'object'
      ) {
        this.logger.error(
          {
            status,
            data: axiosError.response.data,
            requestId: this.safeRequestId(axiosError),
          },
          'Amadeus request failed',
        );
      } else {
        this.logger.error(
          {
            status,
            message: axiosError.message,
            requestId: this.safeRequestId(axiosError),
          },
          'Amadeus request failed',
        );
      }

      throw error;
    }
  }

  private safeRequestId(error: AxiosError): string | undefined {
    const request: any = error.config;
    if (!request) {
      return undefined;
    }
    const raw = `${request.method ?? 'GET'}:${request.url ?? ''}:${
      request.data ?? ''
    }`;
    return crypto.createHash('sha1').update(raw).digest('hex');
  }
}
