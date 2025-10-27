import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

interface OtelOptions {
  serviceName?: string;
  endpoint?: string;
}

@Injectable()
export class OtelService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OtelService.name);
  private sdk: NodeSDK | null = null;
  private readonly options: OtelOptions;
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Optional() @Inject('OTEL_OPTIONS') options?: OtelOptions,
  ) {
    this.enabled = this.configService.get<boolean>('otel.enabled') ?? false;

    const serviceName =
      options?.serviceName ??
      this.configService.get<string>('OTEL_SERVICE_NAME') ??
      this.configService.get<string>('APP_NAME') ??
      'synchron-ai-backend';

    const endpoint =
      options?.endpoint ??
      this.configService.get<string>('OTEL_EXPORTER_OTLP_ENDPOINT') ??
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

    this.options = {
      serviceName,
      endpoint,
    };
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('OpenTelemetry disabled via configuration (otel.enabled=false)');
      return;
    }

    if (!this.options.endpoint) {
      this.logger.log(
        'OpenTelemetry endpoint not configured (OTEL_EXPORTER_OTLP_ENDPOINT); tracing disabled',
      );
      return;
    }

    if (this.sdk) {
      return;
    }

    const exporter = new OTLPTraceExporter({
      url: this.options.endpoint,
    });

    this.sdk = new NodeSDK({
      traceExporter: exporter,
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: this.options.serviceName,
      }),
      instrumentations: [getNodeAutoInstrumentations()],
    });

    try {
      await this.sdk.start();
      this.logger.log(
        `OpenTelemetry tracing initialised for service ${this.options.serviceName} @ ${this.options.endpoint}`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to initialise OpenTelemetry NodeSDK',
        error instanceof Error ? error.stack : String(error),
      );
      this.sdk = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sdk) {
      try {
        await this.sdk.shutdown();
      } catch (error) {
        this.logger.warn(
          'Failed to shutdown OpenTelemetry NodeSDK cleanly',
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        this.sdk = null;
      }
    }
  }
}
