import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { json, urlencoded } from 'express';
import { createHmac } from 'crypto';
import request from 'supertest';
import { PaymentsController } from '../src/modules/external/payments/payments.controller';
import { StripeService } from '../src/modules/external/payments/stripe.service';
import { IyzicoService } from '../src/modules/external/payments/iyzico.service';
import { RedisService } from '../src/lib/nestjs-redis';
import { KafkaService } from '../src/lib/nestjs-kafka';
import { TenantContextService } from '../src/common/context/tenant-context.service';
import { PinoLogger } from 'nestjs-pino';

const redisClientMock = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  setnx: jest.fn(),
  del: jest.fn(),
};

const redisServiceMock = {
  getClient: () => redisClientMock,
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  setnx: jest.fn(),
  buildTenantKey: jest.fn((tenant: string, service: string, ...parts: (string | number)[]) =>
    [tenant, service, parts.join(':')].filter(Boolean).join(':'),
  ),
};

const kafkaServiceMock = {
  emit: jest.fn(),
  formatTenantTopic: jest.fn((tenantId: string, suffix: string) => `tenant.${tenantId}.${suffix}`),
};

const tenantContextMock = {
  getTenantId: jest.fn(() => 'chat365'),
  runWithContext: jest.fn(),
  runWithTenant: jest.fn(),
  setTenant: jest.fn(),
  getRequestId: jest.fn(() => 'req-123'),
  getActorId: jest.fn(() => undefined),
  getToken: jest.fn(() => undefined),
};

const loggerMock = {
  setContext: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
  info: jest.fn(),
};

function generateValidHmac(secret: string, payload: string, timestamp = Math.floor(Date.now() / 1000)) {
  const signedPayload = `${timestamp}.${payload}`;
  const signature = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('Payment webhook signature validation', () => {
  let app: INestApplication;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? 'secret-key';

  beforeAll(async () => {
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? 'sk_live_dummy';
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;

    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        StripeService,
        { provide: IyzicoService, useValue: { handleWebhook: jest.fn() } },
        { provide: RedisService, useValue: redisServiceMock },
        { provide: KafkaService, useValue: kafkaServiceMock },
        { provide: TenantContextService, useValue: tenantContextMock },
        { provide: PinoLogger, useValue: loggerMock },
        ConfigService,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(json({
      verify: (req: any, _res, buf: Buffer) => {
        req.rawBody = Buffer.from(buf);
      },
    }));
    app.use(urlencoded({
      extended: true,
      verify: (req: any, _res, buf: Buffer) => {
        req.rawBody = Buffer.from(buf);
      },
    }));
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rejects invalid HMAC', async () => {
    const payload = {
      id: 'evt_invalid_signature',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_invalid' } },
    };

    const response = await request(app.getHttpServer())
      .post('/api/webhooks/payments')
      .set('Stripe-Signature', 't=12345,v1=fake-hmac')
      .send(payload);

    expect(response.status).toBe(401);
  });

  it('accepts valid HMAC', async () => {
    const payload = {
      id: 'evt_valid_signature',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_valid' } },
    };
    const rawPayload = JSON.stringify(payload);
    const validSig = generateValidHmac(webhookSecret, rawPayload);

    const response = await request(app.getHttpServer())
      .post('/api/webhooks/payments')
      .set('Stripe-Signature', validSig)
      .send(payload);

    expect(response.status).toBe(200);
  });
});
