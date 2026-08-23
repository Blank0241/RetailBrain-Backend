import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Prediction from '../models/Prediction.js';
import { AppError } from '../middleware/errorMiddleware.js';
import { env } from '../config/env.js';
import { predict } from './mlService.js';

const SALT_ROUNDS = 12;

export async function registerUser({ name, email, password }) {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new AppError(409, 'EMAIL_IN_USE', 'An account with that email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, passwordHash });
  return user;
}

export async function authenticateUser({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  return user;
}

/**
 * Creates a brand-new throwaway demo account (per the product decision: each
 * "Continue as Demo User" click gets a fresh account, not a shared one) and
 * seeds it with a handful of sample predictions so Dashboard/History/
 * Analytics aren't empty on first look.
 */
export async function createDemoUser() {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const passwordHash = await bcrypt.hash(`${env.demoUserPassword}-${suffix}`, SALT_ROUNDS);

  const user = await User.create({
    name: 'Demo User',
    email: `demo-${suffix}@retailbrain.demo`,
    passwordHash,
    isDemo: true,
    lastLoginAt: new Date(),
  });

  await seedDemoPredictions(user._id);

  return user;
}

const DEMO_CUSTOMERS = [
  'Aarav Mehta', 'Diya Krishnan', 'Rohan Iyer', 'Ananya Reddy', 'Vivaan Nair',
  'Ishita Rao', 'Kabir Menon', 'Sanya Pillai',
];
const CITIES = ['Chennai', 'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad'];
const SEGMENTS = ['New', 'Regular', 'Loyal', 'At Risk', 'VIP'];
const CATEGORIES = ['Electronics', 'Apparel', 'Home & Kitchen', 'Beauty & Personal Care', 'Grocery'];
const PAYMENT_METHODS = ['UPI', 'Credit Card', 'Debit Card', 'Cash on Delivery', 'Net Banking'];
const SHIPPING_METHODS = ['Standard', 'Express', 'Same Day', 'Store Pickup'];

async function seedDemoPredictions(userId) {
  const docs = [];
  for (let i = 0; i < 12; i += 1) {
    const inputData = {
      customerId: `CUST-DEMO-${1000 + i}`,
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

    const daysAgo = Math.floor(Math.random() * 30);
    const createdAt = new Date(Date.now() - daysAgo * 86400000);
    const isEvaluated = Math.random() > 0.35;

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
      userId,
      customer: DEMO_CUSTOMERS[i % DEMO_CUSTOMERS.length],
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
}
