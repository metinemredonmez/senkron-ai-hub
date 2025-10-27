import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { lastValueFrom } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class TelemetrySyncService implements OnModuleInit {
  private readonly logger = new Logger(TelemetrySyncService.name);
  private readonly prometheusEndpoint?: string;
  private readonly tempoEndpoint?: string;
  private readonly telemetryEnabled: boolean;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    this.telemetryEnabled =
      this.configService.get<boolean>('otel.enabled') ?? false;
    this.prometheusEndpoint = this.configService.get<string>('hub.prometheusEndpoint') ?? process.env.PROMETHEUS_PUSHGATEWAY_URL;
    this.tempoEndpoint = this.configService.get<string>('hub.tempoEndpoint') ?? process.env.TEMPO_ENDPOINT;
  }

  async onModuleInit(): Promise<void> {
    if (!this.telemetryEnabled) {
      this.logger.debug('Telemetry disabled; skipping Prometheus/Tempo sync initialisation');
      return;
    }
    const missing: string[] = [];
    if (!this.prometheusEndpoint) {
      missing.push('PROMETHEUS_PUSHGATEWAY_URL');
    }
    if (!this.tempoEndpoint) {
      missing.push('TEMPO_ENDPOINT');
    }
    if (missing.length) {
      this.logger.warn(`Telemetry endpoints missing: ${missing.join(', ')}. Initial push may be limited.`);
    }
    if (!this.prometheusEndpoint) {
      return;
    }
    try {
      await this.pushMetrics();
      this.logger.log('[TelemetrySync] Initial metrics pushed');
    } catch (error) {
      this.logger.warn('Initial metrics push failed', error as Error);
    }
  }

  async verifyPrometheusConnection(): Promise<void> {
    if (!this.telemetryEnabled) {
      return;
    }
    if (!this.prometheusEndpoint) {
      this.logger.warn('Prometheus endpoint not configured; metrics push disabled');
      return;
    }
    try {
      await lastValueFrom(this.httpService.get(this.prometheusEndpoint, { timeout: 3000 }));
      this.logger.log(`Prometheus reachable at ${this.prometheusEndpoint}`);
    } catch (error) {
      this.logger.warn(`Failed to reach Prometheus endpoint ${this.prometheusEndpoint}`, error as Error);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async pushMetrics(): Promise<void> {
    if (!this.telemetryEnabled) {
      return;
    }
    if (!this.prometheusEndpoint) {
      return;
    }
    try {
      const metrics = await this.metricsService.getSnapshot();
      await lastValueFrom(
        this.httpService.post(this.prometheusEndpoint, metrics, {
          headers: { 'Content-Type': 'text/plain' },
        }),
      );
    } catch (error) {
      this.logger.error('Failed to push metrics to Prometheus gateway', error as Error);
    }

    if (this.tempoEndpoint) {
      await this.metricsService.pushMetricsToTempo();
    }
  }
}
