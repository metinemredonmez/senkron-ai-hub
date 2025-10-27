import { registerAs } from '@nestjs/config';

export interface OtelConfig {
  endpoint: string;
  serviceName: string;
  enabled: boolean;
  mode: string;
}

export const otelConfig = registerAs('otel', () => {
  const nodeEnv = (process.env.NODE_ENV ?? 'local').toLowerCase();
  const dockerFlag = ['1', 'true'].includes(
    (process.env.DOCKER ?? '').toLowerCase(),
  );
  const isLocalMode =
    !dockerFlag && ['development', 'dev', 'local'].includes(nodeEnv);

  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
    process.env.OTLP_HTTP_ENDPOINT ??
    'http://localhost:4319/v1/traces';

  const enabled = !isLocalMode && endpoint.length > 0;

  return {
    endpoint: enabled ? endpoint : '',
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'health-tourism-backend',
    enabled,
    mode: nodeEnv,
  } satisfies OtelConfig;
});
