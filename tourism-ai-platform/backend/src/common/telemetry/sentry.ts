import * as Sentry from '@sentry/node';
import '@sentry/tracing';

let initialized = false;

export function setupSentry(): void {
  if (initialized) {
    return;
  }
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
  });
  initialized = true;
}
