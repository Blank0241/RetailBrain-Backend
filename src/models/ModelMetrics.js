import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Cached/aggregated summary. Predictions collection is always the source of
 * truth; this doc can be recomputed at any time via
 * analyticsService.recalculateModelMetrics(). Kept mainly so getAnalytics()
 * can return a `modelMetrics` object cheaply, matching mockData.js's
 * MODEL_METRICS shape.
 */
const modelMetricsSchema = new Schema({
  scope: {
    // 'global' today; left room for per-user metrics later without a migration.
    type: String,
    default: 'global',
    unique: true,
  },
  total: { type: Number, default: 0 },
  correct: { type: Number, default: 0 },
  incorrect: { type: Number, default: 0 },
  pending: { type: Number, default: 0 },
  evaluated: { type: Number, default: 0 },
  accuracy: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model('ModelMetrics', modelMetricsSchema);
