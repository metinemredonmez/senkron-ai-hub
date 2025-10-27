import axios from 'axios';
import { randomUUID } from 'crypto';
import { getKafkaTopics } from './utils/kafka-client';
import { closeRedis, getRedisKeys, pingRedis } from './utils/redis-client';

const TENANT_ID = process.env.TEST_TENANT_ID ?? 'chat365';
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000/api';

const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'X-Tenant': TENANT_ID,
  },
});

async function pollForResult<T>(
  fn: () => Promise<T | null | undefined>,
  { timeoutMs = 10000, intervalMs = 500 } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const result = await fn();
      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  if (lastError) {
    throw lastError;
  }
  throw new Error('Timed out waiting for expected result');
}

jest.setTimeout(120_000);

describe('Synchron AI Hub multi-tenant smoke tests', () => {
  afterAll(async () => {
    await closeRedis();
  });

  it('verifies Redis connectivity and key prefix convention', async () => {
    const pong = await pingRedis();
    expect(pong).toBe('PONG');

    const keys = await getRedisKeys(`${TENANT_ID}:hub:*`);
    expect(Array.isArray(keys)).toBe(true);
    if (keys.length > 0) {
      keys.forEach((key) => expect(key.startsWith(`${TENANT_ID}:hub:`)).toBe(true));
    }
  });

  it('lists tenants via /api/tenants', async () => {
    const response = await httpClient.get('/tenants');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data.length).toBeGreaterThan(0);
  });

  it('retrieves an OnlyChannel token for the tenant', async () => {
    const response = await httpClient.get('/only-channel/token');
    expect(response.status).toBe(200);
    expect(response.data?.tenant).toBe(TENANT_ID);
    expect(typeof response.data?.token).toBe('string');
    expect(response.data.token).toMatch(/^ak_/);
  });

  it('routes hub events to the orchestrator', async () => {
    const eventPayload = {
      id: randomUUID(),
      tenantId: TENANT_ID,
      type: 'case.created',
      source: 'tenant-smoke-test',
      timestamp: new Date().toISOString(),
      payload: {
        message: 'smoke-test-event',
      },
      correlationId: randomUUID(),
      channel: 'system',
    };

    const response = await httpClient.post('/hub/events', eventPayload);
    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ status: expect.any(String) });
  });

  it('exposes tenant-tagged metrics via Prometheus endpoint', async () => {
    const metrics = await pollForResult(async () => {
      const response = await httpClient.get('/hub/metrics', {
        responseType: 'text',
      });
      if (response.status === 200 && response.data.includes(`tenant_id="${TENANT_ID}"`)) {
        return response.data;
      }
      return null;
    });
    expect(metrics).toContain(`tenant_id="${TENANT_ID}"`);
  });

  it('confirms tenant Kafka topics exist', async () => {
    const expectedTopics = [
      `tenant.${TENANT_ID}.hub.events`,
      `tenant.${TENANT_ID}.ai.agent.events`,
    ];
    const topics = await pollForResult(async () => {
      const topicList = await getKafkaTopics();
      return expectedTopics.every((topic) => topicList.includes(topic))
        ? topicList
        : null;
    });
    expectedTopics.forEach((topic) =>
      expect(topics).toEqual(expect.arrayContaining([topic])),
    );
  });

  it('serves Swagger JSON', async () => {
    const response = await axios.get(`${API_BASE_URL}/docs-json`, {
      headers: {
        'X-Tenant': TENANT_ID,
      },
    });
    expect(response.status).toBe(200);
    expect(response.data?.openapi ?? response.data?.swagger).toBeDefined();
  });
});
