import { promises as dns } from 'dns';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | null = null;

export async function setupOpenTelemetry(): Promise<void> {
  if (sdk) {
    return;
  }

  const nodeEnv = (process.env.NODE_ENV ?? 'local').toLowerCase();
  const dockerFlag =
    ['1', 'true', 'yes'].includes((process.env.DOCKER ?? '').toLowerCase()) ||
    process.env.RUNNING_IN_CONTAINER === 'true';
  const isLocalLike = ['local', 'development', 'dev', 'test'].includes(nodeEnv);

  if (!dockerFlag && isLocalLike) {
    console.warn(
      'OpenTelemetry exporter disabled in local/dev environment (no container flag detected)',
    );
    return;
  }

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  const endpoint = await resolveTraceEndpoint();
  const serviceName =
    process.env.OTEL_SERVICE_NAME ?? 'health-tourism-backend';

  if (!endpoint) {
    console.warn(
      'OpenTelemetry exporter disabled: no OTLP endpoint could be resolved',
    );
    return;
  }

  sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'health-tourism',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
        process.env.NODE_ENV ?? 'local',
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  await sdk.start();

  const shutdown = async () => {
    try {
      await sdk?.shutdown();
    } catch (error) {
      console.error('Error shutting down OpenTelemetry', error);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

async function resolveTraceEndpoint(): Promise<string | null> {
  const configuredEndpoint =
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
    process.env.OTLP_HTTP_ENDPOINT;

  const defaultCandidates = [
    'http://localhost:4318/v1/traces',
    'http://127.0.0.1:4318/v1/traces',
    'http://localhost:4319/v1/traces',
    'http://127.0.0.1:4319/v1/traces',
    'http://tempo:4319/v1/traces',
  ];

  const candidates = configuredEndpoint
    ? [configuredEndpoint, ...defaultCandidates.filter((c) => c !== configuredEndpoint)]
    : defaultCandidates;

  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate);
    if (!normalized) {
      continue;
    }

    try {
      const url = new URL(normalized);
      if (!url.hostname) {
        continue;
      }
      await dns.lookup(url.hostname);
      return normalized;
    } catch (error: any) {
      if (error?.code && error.code !== 'ENOTFOUND') {
        diag.error(
          `Failed to resolve OTLP endpoint candidate ${candidate}`,
          error as Error,
        );
      }
    }
  }

  return null;
}

function normalizeCandidate(candidate: string): string | null {
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  const withScheme =
    trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `http://${trimmed}`;

  try {
    const url = new URL(withScheme);
    return url.toString();
  } catch {
    return null;
  }
}
