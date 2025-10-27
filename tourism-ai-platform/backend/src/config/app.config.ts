import { registerAs } from '@nestjs/config';

export interface AppConfig {
  name: string;
  env: string;
  port: number;
  baseUrl: string;
  corsOrigins: string[];
  featureFlags: Record<string, boolean>;
}

export const appConfig = registerAs(
  'app',
  (): AppConfig => ({
    name: 'health-tourism-platform',
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '4000', 10),
    baseUrl: process.env.APP_BASE_URL ?? 'http://localhost:4000',
    corsOrigins:
      (process.env.CORS_ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
        .filter((origin, index, arr) => arr.indexOf(origin) === index),
    featureFlags: {
      speech: (process.env.FEATURE_SPEECH ?? 'false').toLowerCase() === 'true',
      vision: (process.env.FEATURE_VISION ?? 'false').toLowerCase() === 'true',
      personalization:
        (process.env.FEATURE_PERSONALIZATION ?? 'false').toLowerCase() ===
        'true',
    },
  }),
);

export default appConfig;
