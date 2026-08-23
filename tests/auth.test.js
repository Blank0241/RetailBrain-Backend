import request from 'supertest';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';

let app;

beforeAll(async () => {
  await setupTestDB();
  const { createApp } = await import('../src/app.js');
  app = createApp();
});

afterAll(async () => {
  await teardownTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

describe('Auth', () => {
  const credentials = { name: 'Test User', email: 'test@example.com', password: 'password123' };

  test('registers a new user', async () => {
    const res = await request(app).post('/api/auth/register').send(credentials);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(credentials.email);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  test('rejects duplicate registration', async () => {
    await request(app).post('/api/auth/register').send(credentials);
    const res = await request(app).post('/api/auth/register').send(credentials);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('logs in with correct credentials', async () => {
    await request(app).post('/api/auth/register').send(credentials);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(credentials.email);
  });

  test('rejects invalid login', async () => {
    await request(app).post('/api/auth/register').send(credentials);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  test('returns current user when authenticated', async () => {
    const registerRes = await request(app).post('/api/auth/register').send(credentials);
    const cookie = registerRes.headers['set-cookie'];

    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(credentials.email);
  });

  test('rejects /me without a session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
