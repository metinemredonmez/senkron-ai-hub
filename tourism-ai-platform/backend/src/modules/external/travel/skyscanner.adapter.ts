import { Injectable } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ConfigService } from '@nestjs/config';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Histogram, register } from 'prom-client';
import axiosRetry from 'axios-retry';
import { PinoLogger } from 'nestjs-pino';

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
export class SkyscannerAdapter {
  private readonly axios: AxiosInstance;
  private readonly apiKey: string;

  constructor(
    configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    const baseURL =
      configService.get<string>('SKYSCANNER_API_URL') ??
      'https://partners.api.skyscanner.net';
    this.apiKey = configService.get<string>('SKYSCANNER_API_KEY') ?? '';

    this.logger.setContext(SkyscannerAdapter.name);

    this.axios = axios.create({
      baseURL,
      timeout: 10_000,
    });

    axiosRetry(this.axios, {
      retries: 2,
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

  async searchFlightsFallback(params: Record<string, any>): Promise<any> {
    return this.request<any>({
      method: 'GET',
      url: '/apiservices/v3/flights/live/itineraries',
      params,
      spanName: 'skyscanner.searchFlights',
    });
  }

  async searchHotels(params: Record<string, any>): Promise<any> {
    return this.request<any>({
      method: 'GET',
      url: '/apiservices/hotels/live/search',
      params,
      spanName: 'skyscanner.searchHotels',
    });
  }

  private async request<T>(options: AxiosRequestConfig & { spanName: string }): Promise<T> {
    const span = tracer.startSpan(options.spanName, {
      attributes: {
        integration_call: 'skyscanner',
        'http.method': options.method ?? 'GET',
        'http.url': options.url ?? '',
      },
    });

    const start = process.hrtime.bigint();
    try {
      const response: AxiosResponse<T> = await this.axios.request<T>({
        ...options,
        headers: {
          'x-api-key': this.apiKey,
          ...(options.headers ?? {}),
        },
      });

      const duration =
        Number(process.hrtime.bigint() - start) / 1_000_000_000;
      integrationDurationMetric.observe(
        { provider: 'skyscanner', status: String(response.status) },
        duration,
      );

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status ?? 0;
      const duration =
        Number(process.hrtime.bigint() - start) / 1_000_000_000;

      integrationDurationMetric.observe(
        { provider: 'skyscanner', status: String(status || 0) },
        duration,
      );

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: axiosError.message,
      });
      span.recordException(error);
      span.end();

      this.logger.error(
        {
          status,
          data: axiosError.response?.data,
        },
        'Skyscanner request failed',
      );
      throw error;
    }
  }
}
