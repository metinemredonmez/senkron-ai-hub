import { trace } from '@opentelemetry/api';
import { Histogram, register } from 'prom-client';

const HISTOGRAM_NAME = 'integration_request_duration_seconds';
const HISTOGRAM_HELP = 'Integration request duration in seconds';

const BUCKETS = [0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10];

const existingHistogram = (): Histogram<string> | null => {
  try {
    return register.getSingleMetric(HISTOGRAM_NAME) as Histogram<string> | null;
  } catch {
    return null;
  }
};

export const integrationDurationMetric =
  existingHistogram() ??
  new Histogram({
    name: HISTOGRAM_NAME,
    help: HISTOGRAM_HELP,
    labelNames: ['provider', 'status'],
    buckets: BUCKETS,
  });

export const paymentsTracer = trace.getTracer('payments-integrations');
