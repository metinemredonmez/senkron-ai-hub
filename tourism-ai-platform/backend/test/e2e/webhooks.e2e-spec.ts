import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { json } from 'express';
import { createHmac } from 'crypto';
import { WebhooksController } from '../../src/modules/external/webhooks/webhooks.controller';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

describe('WebhooksController (e2e)', () => {
  let app: INestApplication;
  let server: any;
  const secret = 'test-secret';

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'DOKTOR365_SECRET') {
                return secret;
              }
              return undefined;
            },
          },
        },
        {
          provide: PinoLogger,
          useValue: {
            setContext: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(
      json({
        verify: (req: any, _res, buf: Buffer) => {
          req.rawBody = Buffer.from(buf);
        },
      }),
    );
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts valid Doktor365 webhook when signature matches', async () => {
    const payload = {
      event: 'patient.updated',
      data: { patientId: '123' },
    };
    const rawBody = JSON.stringify(payload);
    const signature = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;

    await request(server)
      .post('/webhooks/doktor365')
      .set('x-doktor365-signature', signature)
      .send(payload)
      .expect(200)
      .expect({ acknowledged: true });
  });

  it('rejects Doktor365 webhook when signature is invalid', async () => {
    const payload = {
      event: 'patient.updated',
      data: { patientId: '123' },
    };

    await request(server)
      .post('/webhooks/doktor365')
      .set('x-doktor365-signature', 'sha256=invalidsignature')
      .send(payload)
      .expect(401);
  });

  it('returns 400 when Doktor365 body is missing', async () => {
    const signature = `sha256=${createHmac('sha256', secret).update('').digest('hex')}`;
    await request(server)
      .post('/webhooks/doktor365')
      .set('x-doktor365-signature', signature)
      .expect(400);
  });

  it('accepts WhatsApp webhook payload', async () => {
    await request(server)
      .post('/webhooks/whatsapp')
      .send({ type: 'text', from: '+905551112233', body: { text: 'hello' } })
      .expect(200)
      .expect({ ok: true });
  });
});
