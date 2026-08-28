import { z } from 'zod';
import { ACTUAL_OUTCOME_OPTIONS } from '../models/Prediction.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const objectIdParamSchema = z.object({
  id: z.string().regex(objectIdRegex, 'Invalid prediction id.'),
});

// Mirrors PREDICTION_FORM_CONFIG in the frontend's src/data/mockData.js.
// The real Random Forest model's 19 features are derived server-side (see
// mlService.js) from the customer/item pair — they are never accepted
// directly from the client, so this schema only validates the two
// identifiers the Predict page actually collects.
export const predictionInputSchema = z.object({
  customerId: z.string().trim().min(1).max(60),
  itemId: z.string().trim().min(1).max(60),
});

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
