import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HealthCheckController } from '../../src/modules/health-check/health-check.controller';
import { HealthCheckService, MemoryHealthIndicator, TypeOrmHealthIndicator } from '@nestjs/terminus';

const mockHealthService = {
  check: jest.fn().mockImplementation(async () => ({ status: 'ok' })),
};

const mockIndicator = {
  pingCheck: jest.fn().mockResolvedValue({}),
  checkHeap: jest.fn().mockResolvedValue({}),
};

describe('Health endpoint (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthCheckController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthService },
        { provide: TypeOrmHealthIndicator, useValue: mockIndicator },
        { provide: MemoryHealthIndicator, useValue: mockIndicator },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health returns ok', async () => {
    const response = await request(app.getHttpServer()).get('/health');
    expect(response.status).toBe(200);
  });
});
