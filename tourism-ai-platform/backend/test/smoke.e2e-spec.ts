import request from 'supertest';

const baseUrl =
  process.env.SMOKE_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:4000';
const tenant = process.env.SMOKE_TENANT ?? 'demo-tenant';
const loginEmail = process.env.SMOKE_LOGIN_EMAIL ?? '';
const loginPassword = process.env.SMOKE_LOGIN_PASSWORD ?? '';

describe('Production smoke routes', () => {
  const client = request(baseUrl);
  let bearerToken: string | undefined;

  it('GET /api/health returns service status', async () => {
    const response = await client.get('/api/health').set('X-Tenant', tenant);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
  });

  it('GET /api/docs-json exposes swagger metadata', async () => {
    const response = await client.get('/api/docs-json');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('info');
    expect(response.body.info).toHaveProperty('title');
  });

  it('GET /api/cases rejects unauthenticated requests', async () => {
    const response = await client.get('/api/cases').set('X-Tenant', tenant);
    expect([401, 403]).toContain(response.status);
  });

  const loginTest = loginEmail && loginPassword ? it : it.skip;

  loginTest('POST /api/auth/login issues a JWT', async () => {
    const response = await client
      .post('/api/auth/login')
      .set('X-Tenant', tenant)
      .send({ email: loginEmail, password: loginPassword });

    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
    expect(response.body).toHaveProperty('accessToken');
    bearerToken = response.body.accessToken;
  });

  const authenticatedTest =
    loginEmail && loginPassword ? it : it.skip;

  authenticatedTest('GET /api/cases succeeds with bearer token', async () => {
    expect(bearerToken).toBeDefined();
    const response = await client
      .get('/api/cases')
      .set('X-Tenant', tenant)
      .set('Authorization', `Bearer ${bearerToken}`);
    expect([200, 204]).toContain(response.status);
  });
});
