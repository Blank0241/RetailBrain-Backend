// Development-only seed script. Never run automatically; invoked via
// `npm run seed`. Refuses to run against a production environment.
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import User from '../models/User.js';
import Prediction from '../models/Prediction.js';
import { predict } from '../services/mlService.js';
import { recalculateModelMetrics } from '../services/analyticsService.js';

const CITIES = ['Chennai', 'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad'];
const SEGMENTS = ['New', 'Regular', 'Loyal', 'At Risk', 'VIP'];
const CATEGORIES = ['Electronics', 'Apparel', 'Home & Kitchen', 'Beauty & Personal Care', 'Grocery', 'Footwear'];
const PAYMENT_METHODS = ['UPI', 'Credit Card', 'Debit Card', 'Cash on Delivery', 'Net Banking'];
const SHIPPING_METHODS = ['Standard', 'Express', 'Same Day', 'Store Pickup'];
const CUSTOMERS = [
  'Aarav Mehta', 'Diya Krishnan', 'Rohan Iyer', 'Ananya Reddy', 'Vivaan Nair',
  'Ishita Rao', 'Kabir Menon', 'Sanya Pillai', 'Arjun Subramaniam', 'Meera Chandran',
];

async function seed() {
  if (env.isProd) {
    console.error('[seed] Refusing to run: NODE_ENV=production. This script is for local/dev only.');
    process.exit(1);
  }

  await connectDB();

  const email = 'demo.seed@retailbrain.local';
  const plainPassword = 'DemoPassword123!';

  let user = await User.findOne({ email });
  if (!user) {
    const passwordHash = await bcrypt.hash(plainPassword, 12);
    user = await User.create({ name: 'Seed Demo User', email, passwordHash });
    console.log(`[seed] Created demo user: ${email} / ${plainPassword} (fake credentials, dev only)`);
  } else {
    console.log(`[seed] Demo user already exists: ${email}`);
  }

  const existingCount = await Prediction.countDocuments({ userId: user._id });
  if (existingCount > 0) {
    console.log(`[seed] User already has ${existingCount} predictions, skipping prediction seeding.`);
  } else {
    const docs = [];
    for (let i = 0; i < 30; i += 1) {
      const inputData = {
        customerId: `CUST-${10000 + i}`,
        age: 20 + Math.floor(Math.random() * 40),
        gender: Math.random() > 0.5 ? 'Female' : 'Male',
        location: CITIES[i % CITIES.length],
        segment: SEGMENTS[i % SEGMENTS.length],
        productCategory: CATEGORIES[i % CATEGORIES.length],
        orderValue: Math.round(600 + Math.random() * 8500),
        quantity: 1 + Math.floor(Math.random() * 4),
        discount: Math.floor(Math.random() * 25),
        paymentMethod: PAYMENT_METHODS[i % PAYMENT_METHODS.length],
        shippingMethod: SHIPPING_METHODS[i % SHIPPING_METHODS.length],
        previousOrders: Math.floor(Math.random() * 30),
        previousSpending: Math.round(Math.random() * 60000),
        avgOrderValue: Math.round(1000 + Math.random() * 4000),
        returnCount: Math.floor(Math.random() * 3),
        customerTenure: Math.floor(Math.random() * 36),
      };

      // eslint-disable-next-line no-await-in-loop
      const { prediction, confidence } = await predict(inputData);

      const daysAgo = Math.floor(Math.random() * 60);
      const createdAt = new Date(Date.now() - daysAgo * 86400000);
      const isEvaluated = Math.random() > 0.32;

      let actualOutcome = 'Not Known Yet';
      let status = 'Pending';
      let evaluatedAt = null;

      if (isEvaluated) {
        const matches = Math.random() > 0.24;
        const predictedPurchase = prediction === 'Likely to Purchase';
        actualOutcome = matches
          ? (predictedPurchase ? 'Purchased' : 'Did Not Purchase')
          : (predictedPurchase ? 'Did Not Purchase' : 'Purchased');
        status = matches ? 'Correct' : 'Incorrect';
        evaluatedAt = new Date(createdAt.getTime() + 3 * 86400000);
      }

      docs.push({
        userId: user._id,
        customer: CUSTOMERS[i % CUSTOMERS.length],
        inputData,
        prediction,
        confidence,
        actualOutcome,
        status,
        createdAt,
        evaluatedAt,
      });
    }

    // timestamps: false preserves our deliberately varied createdAt dates
    // (schema timestamps would otherwise overwrite them with "now").
    await Prediction.insertMany(docs, { timestamps: false });
    console.log(`[seed] Inserted ${docs.length} sample predictions for ${email}`);
  }

  await recalculateModelMetrics();
  console.log('[seed] Recalculated global ModelMetrics.');

  await disconnectDB();
  console.log('[seed] Done.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
