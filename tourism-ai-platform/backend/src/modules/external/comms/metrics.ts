import { trace } from '@opentelemetry/api';
import { Counter, Histogram, register } from 'prom-client';

const INTEGRATION_HISTOGRAM_NAME = 'integration_request_duration_seconds';
const PIPELINE_HISTOGRAM_NAME = 'conversation_pipeline_duration_seconds';
const INTENT_COUNTER_NAME = 'comms_intents_total';

const HISTOGRAM_BUCKETS = [0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10];

function getOrCreateHistogram(
  name: string,
  help: string,
  labelNames: string[],
  buckets: number[],
): Histogram<string> {
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
}

function getOrCreateCounter(
  name: string,
  help: string,
  labelNames: string[],
): Counter<string> {
  const existing = register.getSingleMetric(name) as Counter<string> | null;
  if (existing) {
    return existing;
  }
  return new Counter({
    name,
    help,
    labelNames,
  });
}

export const integrationDurationMetric = getOrCreateHistogram(
  INTEGRATION_HISTOGRAM_NAME,
  'Integration request duration in seconds',
  ['provider', 'status'],
  HISTOGRAM_BUCKETS,
);

export const pipelineDurationMetric = getOrCreateHistogram(
  PIPELINE_HISTOGRAM_NAME,
  'Latency of the conversational intelligence pipeline in seconds',
  ['intent'],
  HISTOGRAM_BUCKETS,
);

export const intentCounter = getOrCreateCounter(
  INTENT_COUNTER_NAME,
  'Total number of detected intents',
  ['intent', 'outcome'],
);

export const whatsappTracer = trace.getTracer('whatsapp-integration');
export const pipelineTracer = trace.getTracer('conversation-pipeline');
