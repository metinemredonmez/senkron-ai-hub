import { Logger, RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { Logger as PinoLogger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import helmet from 'helmet';
import type { Request } from 'express';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import axios from 'axios';
import { AppModule } from './app.module';
import { setupOpenTelemetry } from './common/telemetry/opentelemetry';
import { setupSentry } from './common/telemetry/sentry';



async function bootstrap() {
  await setupOpenTelemetry();
  setupSentry();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const pino = app.get(PinoLogger);
  app.useLogger(pino);

  const configService = app.get(ConfigService);
  const corsOrigins = configService.get<string[]>('app.corsOrigins') ?? [];
  const originSet = new Set(corsOrigins);
  const allowAllOrigins = originSet.size === 0 || originSet.has('*');


  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowAllOrigins || originSet.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Tenant',
      'x-tenant',
      'X-Idempotency-Key',
      'x-idempotency-key',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['X-Request-Id'],
    credentials: true,
    maxAge: 60 * 60 * 24,
  });

  app.enableShutdownHooks();
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'metrics', method: RequestMethod.GET }],
  });
  app.use(helmet());
  app.use(
    json({
      limit: '10mb',
      verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(
    urlencoded({
      extended: true,
      verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = Buffer.from(buf);
      },
    }),
  );
  app.useGlobalPipes(new ZodValidationPipe());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SenkronAI Hub API')
    .setDescription(
      'APIs for managing health tourism patient journeys. All endpoints require tenant scoping via X-Tenant header.',
    )
    .setVersion('2.0.0')
    .addBearerAuth()
    .addServer('/api')
    .addServer('http://localhost:3000', 'Development')
    .addServer('https://api.chat365.com.tr', 'Production')
    .addServer('https://api.doktor365.com.tr', 'Doktor365 API (External)')
    .addTag('tenants')
    .addTag('patients')
    .addTag('cases')
    .addTag('providers')
    .addTag('catalog')
    .addTag('pricing')
    .addTag('travel')
    .addTag('bookings')
    .addTag('docs-visa')
    .addTag('comms')
    .addTag('payments')
    .addTag('ai-bridge')
    .addTag('webhooks')
    .build();

  let document = SwaggerModule.createDocument(app, swaggerConfig);
  try {
    const doktor365Response = await axios.get('https://api.doktor365.com.tr/docs/api-docs.json');
    const doktor365Spec = doktor365Response.data ?? {};
    const mergedTagsSource = [
      ...(Array.isArray(document.tags) ? document.tags : []),
      ...(Array.isArray(doktor365Spec.tags) ? doktor365Spec.tags : []),
    ];
    const mergedTags =
      mergedTagsSource.length > 0
        ? Array.from(
            new Map(
              mergedTagsSource.map((tag: any) => {
                if (tag && typeof tag === 'object' && tag.name) {
                  return [tag.name, tag];
                }
                const tagName = typeof tag === 'string' ? tag : JSON.stringify(tag);
                return [tagName, { name: tagName }];
              }),
            ).values(),
          )
        : undefined;

    document = {
      ...document,
      paths: {
        ...(document.paths ?? {}),
        ...(doktor365Spec.paths ?? {}),
      },
      components: {
        ...(document.components ?? {}),
        ...(doktor365Spec.components ?? {}),
      },
      tags: mergedTags,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pino.warn({ message }, 'Failed to merge Doktor365 Swagger spec');
  }

  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
  });

  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.get('/api/docs-json', (_req, res) => res.json(document));

  const docsDir = './docs';
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(`${docsDir}/swagger.json`, JSON.stringify(document, null, 2));
  fs.writeFileSync(`${docsDir}/swagger.yaml`, yaml.dump(document));

  const port = configService.get<number>('app.port', 4000);
  await app.listen(port);
  pino.log(`🚀 Backend server running on port ${port}`);
  pino.log('✅ Application readiness checks configured');
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap Nest application', error);
  process.exit(1);
});
