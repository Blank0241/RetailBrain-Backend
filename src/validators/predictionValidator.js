import { z } from 'zod';
import { ACTUAL_OUTCOME_OPTIONS } from '../models/Prediction.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const objectIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid prediction id.'),
});

// Mirrors PREDICTION_FORM_CONFIG in the frontend's src/data/mockData.js.
// Kept intentionally permissive on unknown-but-harmless extra keys (the
// frontend config can grow new ML input fields) while still enforcing types
// and bounds on the fields the mock model / UI actually depend on.
export const predictionInputSchema = z.object({
  customerId: z.string().trim().min(1).max(60),
  age: z.number().min(18).max(100),
  gender: z.enum(['Male', 'Female', 'Other']),
  location: z.string().trim().min(1).max(100),
  segment: z.string().trim().min(1).max(60),
  productCategory: z.string().trim().min(1).max(100),
  orderValue: z.number().min(0),
  quantity: z.number().min(1),
  discount: z.number().min(0).max(100).optional().default(0),
  paymentMethod: z.string().trim().min(1).max(60),
  shippingMethod: z.string().trim().min(1).max(60),
  previousOrders: z.number().min(0),
  previousSpending: z.number().min(0),
  avgOrderValue: z.number().min(0),
  returnCount: z.number().min(0).optional().default(0),
  customerTenure: z.number().min(0),
}).passthrough();

export const createPredictionSchema = z.object({
  inputData: predictionInputSchema,
});

export const submitOutcomeSchema = z.object({
  actualOutcome: z.enum(ACTUAL_OUTCOME_OPTIONS),
});

export const historyQuerySchema = z.object({
  search: z.string().trim().max(200).optional().default(''),
  status: z.enum(['All', 'Correct', 'Incorrect', 'Pending']).optional().default('All'),
  sortBy: z.enum(['newest', 'oldest', 'confidence']).optional().default('newest'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(8),
});
