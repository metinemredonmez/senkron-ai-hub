import { registerAs } from '@nestjs/config';

export interface IntegrationsConfig {
  whatsapp: {
    baseUrl: string;
    token: string;
    verifyToken: string;
  };
  amadeus: {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
  };
  payments: {
    baseUrl: string;
    apiKey: string;
  };
  efatura: {
    webhookToken: string;
  };
  s3: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  orchestrator: {
    baseUrl: string;
    timeoutMs: number;
  };
  doktor365: {
    baseUrl: string;
    authUrl: string;
    clientId: string;
    clientSecret: string;
    scope: string;
    audience?: string;
    tokenTtlBufferSec: number;
    requestTimeoutMs: number;
    circuitBreaker: {
      failureThreshold: number;
      coolDownMs: number;
    };
  };
}

export const integrationsConfig = registerAs(
  'integrations',
  (): IntegrationsConfig => ({
    whatsapp: {
      baseUrl:
        process.env.WHATSAPP_BASE_URL ??
        'https://graph.facebook.com/v17.0',
      token: process.env.WHATSAPP_TOKEN ?? 'local-whatsapp-token',
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? 'verify-token',
    },
    amadeus: {
      baseUrl: process.env.AMADEUS_BASE_URL ?? 'https://test.api.amadeus.com',
      clientId: process.env.AMADEUS_CLIENT_ID ?? 'demo-id',
      clientSecret: process.env.AMADEUS_CLIENT_SECRET ?? 'demo-secret',
    },
    payments: {
      baseUrl: process.env.PAYMENT_BASE_URL ?? 'https://payments.example.com',
      apiKey: process.env.PAYMENT_API_KEY ?? 'payment-key',
    },
    efatura: {
      webhookToken: process.env.EFATURA_WEBHOOK_TOKEN ?? 'efatura-token',
    },
    s3: {
      endpoint: process.env.S3_ENDPOINT ?? 'http://minio:9000',
      region: process.env.S3_REGION ?? 'us-east-1',
      bucket: process.env.S3_BUCKET ?? 'health-tourism-docs',
      accessKeyId: process.env.S3_ACCESS_KEY ?? 'minioadmin',
      secretAccessKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
    },
    orchestrator: {
      baseUrl:
        process.env.AI_ORCHESTRATOR_URL ?? 'http://orchestrator-svc:8080',
      timeoutMs: parseInt(process.env.AI_ORCHESTRATOR_TIMEOUT ?? '10000', 10),
    },
    doktor365: {
      baseUrl:
        process.env.DOKTOR365_BASE_URL ??
        'https://api.sandbox.doktor365.com',
      authUrl:
        process.env.DOKTOR365_AUTH_URL ??
        'https://auth.sandbox.doktor365.com/oauth/token',
      clientId: process.env.DOKTOR365_CLIENT_ID ?? 'demo-client-id',
      clientSecret: process.env.DOKTOR365_CLIENT_SECRET ?? 'demo-secret',
      scope: process.env.DOKTOR365_SCOPE ?? 'patient.read patient.write',
      audience: process.env.DOKTOR365_AUDIENCE,
      tokenTtlBufferSec: parseInt(
        process.env.DOKTOR365_TOKEN_BUFFER_SEC ?? '30',
        10,
      ),
      requestTimeoutMs: parseInt(
        process.env.DOKTOR365_TIMEOUT_MS ?? '8000',
        10,
      ),
      circuitBreaker: {
        failureThreshold: parseInt(
          process.env.DOKTOR365_CIRCUIT_FAILURES ?? '5',
          10,
        ),
        coolDownMs: parseInt(
          process.env.DOKTOR365_CIRCUIT_COOLDOWN_MS ?? '60000',
          10,
        ),
      },
    },
  }),
);

export default integrationsConfig;
