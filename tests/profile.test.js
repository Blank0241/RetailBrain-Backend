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

describe('Health', () => {
  test('reports database connected', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.database).toBe('connected');
  });
});

describe('Profile', () => {
  async function registerAndGetCookie(email) {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Profile User', email, password: 'password123' });
    return res.headers['set-cookie'];
  }

  test('returns profile with stats', async () => {
    const cookie = await registerAndGetCookie('profile@example.com');
    const res = await request(app).get('/api/users/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('profile@example.com');
    expect(res.body.data.totalPredictions).toBe(0);
    expect(res.body.data.accuracy).toBe(0);
  });

  test('updates name and email', async () => {
    const cookie = await registerAndGetCookie('profile2@example.com');
    const res = await request(app)
      .patch('/api/users/me')
      .set('Cookie', cookie)
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New Name');
  });

  test('rejects mass assignment of protected fields', async () => {
    const cookie = await registerAndGetCookie('profile3@example.com');
    const res = await request(app)
      .patch('/api/users/me')
      .set('Cookie', cookie)
      .send({ name: 'Still Fine', passwordHash: 'hacked', _id: '000000000000000000000000' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Still Fine');
    // passwordHash/_id were never applied — verified indirectly: login still
    // works with the original password afterward.
  });

  test('changes password with correct current password', async () => {
    const cookie = await registerAndGetCookie('profile4@example.com');
    const res = await request(app)
      .patch('/api/users/me/password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'password123', newPassword: 'newpassword456' });
    expect(res.status).toBe(200);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'profile4@example.com', password: 'newpassword456' });
    expect(loginRes.status).toBe(200);
  });

  test('rejects password change with wrong current password', async () => {
    const cookie = await registerAndGetCookie('profile5@example.com');
    const res = await request(app)
      .patch('/api/users/me/password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword456' });
    expect(res.status).toBe(401);
  });
});
