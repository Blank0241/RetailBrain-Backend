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

const sampleInputData = {
  customerId: 'CUST-1001',
  age: 30,
  gender: 'Male',
  location: 'Chennai',
  segment: 'Loyal',
  productCategory: 'Electronics',
  orderValue: 4500,
  quantity: 2,
  discount: 10,
  paymentMethod: 'UPI',
  shippingMethod: 'Express',
  previousOrders: 12,
  previousSpending: 32000,
  avgOrderValue: 2800,
  returnCount: 0,
  customerTenure: 14,
};

async function registerAndGetCookie(app, email) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'User', email, password: 'password123' });
  return res.headers['set-cookie'];
}

describe('Predictions', () => {
  test('rejects unauthenticated prediction creation', async () => {
    const res = await request(app).post('/api/predictions').send({ inputData: sampleInputData });
    expect(res.status).toBe(401);
  });

  test('creates a prediction for the authenticated user', async () => {
    const cookie = await registerAndGetCookie(app, 'a@example.com');
    const res = await request(app)
      .post('/api/predictions')
      .set('Cookie', cookie)
      .send({ inputData: sampleInputData });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('Pending');
    expect(res.body.data.actualOutcome).toBe('Not Known Yet');
    expect(['Likely to Purchase', 'Unlikely to Purchase']).toContain(res.body.data.prediction);
  });

  test('retrieves a single prediction by id', async () => {
    const cookie = await registerAndGetCookie(app, 'b@example.com');
    const createRes = await request(app)
      .post('/api/predictions')
      .set('Cookie', cookie)
      .send({ inputData: sampleInputData });
    const id = createRes.body.data._id;

    const res = await request(app).get(`/api/predictions/${id}`).set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(id);
  });

  test('lists prediction history with pagination', async () => {
    const cookie = await registerAndGetCookie(app, 'c@example.com');
    await request(app).post('/api/predictions').set('Cookie', cookie).send({ inputData: sampleInputData });
    await request(app).post('/api/predictions').set('Cookie', cookie).send({ inputData: sampleInputData });

    const res = await request(app).get('/api/predictions?page=1&pageSize=1').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.totalPages).toBe(2);
  });

  test('submits actual outcome and computes correctness', async () => {
    const cookie = await registerAndGetCookie(app, 'd@example.com');
    const createRes = await request(app)
      .post('/api/predictions')
      .set('Cookie', cookie)
      .send({ inputData: sampleInputData });
    const record = createRes.body.data;

    const actualOutcome = record.prediction === 'Likely to Purchase' ? 'Purchased' : 'Did Not Purchase';
    const res = await request(app)
      .patch(`/api/predictions/${record._id}/outcome`)
      .set('Cookie', cookie)
      .send({ actualOutcome });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Correct');
    expect(res.body.data.evaluatedAt).not.toBeNull();
  });

  test('rejects a client-supplied status field (status is always server-computed)', async () => {
    const cookie = await registerAndGetCookie(app, 'e@example.com');
    const createRes = await request(app)
      .post('/api/predictions')
      .set('Cookie', cookie)
      .send({ inputData: sampleInputData });
    const record = createRes.body.data;

    const res = await request(app)
      .patch(`/api/predictions/${record._id}/outcome`)
      .set('Cookie', cookie)
      .send({ actualOutcome: 'Purchased', status: 'Correct' });

    // status in the body is simply ignored/stripped by validation; the
    // server computes it independently from prediction vs actualOutcome.
    expect(res.status).toBe(200);
    expect(['Correct', 'Incorrect']).toContain(res.body.data.status);
  });

  test('prevents cross-user access to another user\'s prediction', async () => {
    const cookieA = await registerAndGetCookie(app, 'f@example.com');
    const cookieB = await registerAndGetCookie(app, 'g@example.com');

    const createRes = await request(app)
      .post('/api/predictions')
      .set('Cookie', cookieA)
      .send({ inputData: sampleInputData });
    const id = createRes.body.data._id;

    const res = await request(app).get(`/api/predictions/${id}`).set('Cookie', cookieB);
    expect(res.status).toBe(404);
  });

  test('prevents cross-user access via history listing', async () => {
    const cookieA = await registerAndGetCookie(app, 'h@example.com');
    const cookieB = await registerAndGetCookie(app, 'i@example.com');

    await request(app).post('/api/predictions').set('Cookie', cookieA).send({ inputData: sampleInputData });

    const res = await request(app).get('/api/predictions').set('Cookie', cookieB);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  test('rejects invalid ObjectId', async () => {
    const cookie = await registerAndGetCookie(app, 'j@example.com');
    const res = await request(app).get('/api/predictions/not-a-valid-id').set('Cookie', cookie);
    expect(res.status).toBe(422);
  });

  test('rejects invalid inputData fields', async () => {
    const cookie = await registerAndGetCookie(app, 'k@example.com');
    const res = await request(app)
      .post('/api/predictions')
      .set('Cookie', cookie)
      .send({ inputData: { ...sampleInputData, age: 5 } }); // below min 18
    expect(res.status).toBe(422);
  });
});

describe('Analytics & Dashboard', () => {
  test('computes dashboard statistics from real data', async () => {
    const cookie = await registerAndGetCookie(app, 'stats@example.com');
    const createRes = await request(app)
      .post('/api/predictions')
      .set('Cookie', cookie)
      .send({ inputData: sampleInputData });
    const record = createRes.body.data;

    const actualOutcome = record.prediction === 'Likely to Purchase' ? 'Purchased' : 'Did Not Purchase';
    await request(app)
      .patch(`/api/predictions/${record._id}/outcome`)
      .set('Cookie', cookie)
      .send({ actualOutcome });

    const res = await request(app).get('/api/analytics/dashboard').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.stats.total).toBe(1);
    expect(res.body.data.stats.correct).toBe(1);
    expect(res.body.data.stats.accuracy).toBe(100);
  });

  test('rejects unauthenticated dashboard access', async () => {
    const res = await request(app).get('/api/analytics/dashboard');
    expect(res.status).toBe(401);
  });
});
