import { AppError } from '../middleware/errorMiddleware.js';
import { PREDICTION_LABELS } from '../models/Prediction.js';

/**
 * ============================================================================
 * LEGACY DEMO-SEEDING MOCK — UNRELATED TO THE REAL PREDICT WORKFLOW
 * ============================================================================
 * This heuristic scorer is kept ONLY so the existing demo-account seeding
 * (authService.js `createDemoUser`) and the dev seed script (scripts/seed.js)
 * keep working exactly as before, populating Dashboard/History/Analytics
 * with sample data on a fresh account. It predates the final Random Forest
 * integration, is NOT used by the real customer/product Predict workflow
 * below, and should not be extended.
 * ============================================================================
 */
export async function predict(inputData) {
  const score =
    (inputData.previousOrders || 0) * 1.2 +
    (inputData.previousSpending || 0) / 500 +
    (inputData.discount || 0) * 0.8 -
    (inputData.returnCount || 0) * 3 +
    (inputData.orderValue || 0) / 400;

  const confidence = Math.max(52, Math.min(97, Math.round(50 + (score % 48))));
  const prediction = confidence >= 65 ? PREDICTION_LABELS[0] : PREDICTION_LABELS[1];

  return {
    prediction,
    confidence,
    isMock: true, // downstream code / logs can key off this once a real model lands
  };
}

/**
 * ============================================================================
 * REAL RANDOM FOREST INTEGRATION — CUSTOMER + PRODUCT PREDICT WORKFLOW
 * ============================================================================
 * Source of truth for the final model (do not change these):
 *   ml/models/final_random_forest_model/retailbrain_random_forest.pkl
 *   ml/models/final_random_forest_model/features.json
 *   ml/models/final_random_forest_model/model_metadata.json
 *   ml/models/final_random_forest_model/predict_purchase.py
 *
 * The model expects EXACTLY these 19 numeric features per (customer, item)
 * pair — must match features.json exactly (name, order doesn't matter, but
 * no extras and none missing).
 */
export const REQUIRED_FEATURES = [
  'historical_view_count',
  'historical_cart_count',
  'historical_transaction_count',
  'historical_total_interactions',
  'days_since_last_interaction',
  'days_since_first_interaction',
  'previously_viewed',
  'previously_added_to_cart',
  'previously_purchased',
  'customer_total_views',
  'customer_total_carts',
  'customer_total_transactions',
  'customer_unique_items_viewed',
  'customer_unique_items_purchased',
  'customer_activity_frequency',
  'item_total_views',
  'item_total_carts',
  'item_total_transactions',
  'item_unique_visitors',
];

// Mirrors model_metadata.json -> selected_threshold. Must stay in sync with
// predict_purchase.py; do not change this value here.
export const SELECTED_THRESHOLD = 0.42;

/**
 * NOT YET IMPLEMENTED — intentionally.
 *
 * This is where the 19 real feature values for a given (customerId, itemId)
 * pair must be looked up. It is left unimplemented rather than filled with
 * fabricated, randomized, or hard-coded numbers, because none of those would
 * be real historical data.
 *
 * Real historical view/cart/transaction counts need to come from an actual
 * interaction-history data source keyed by customer and item id. As of this
 * change, that source does not exist as a queryable lookup anywhere in this
 * codebase — only the raw training CSV
 * (ml/data/training/retailbrain_training_data_v2.csv) exists, and a flat CSV
 * is not something this endpoint can query per-request.
 *
 * To finish wiring this up:
 *   1. Ingest the real customer/item interaction aggregates into a queryable
 *      store (e.g. a MongoDB collection) keyed by customerId + itemId.
 *   2. Replace the body below with a real lookup against that store,
 *      returning an object with exactly the 19 keys in REQUIRED_FEATURES.
 */
export async function deriveFeaturesForCustomerItem(customerId, itemId) {
  throw new AppError(
    501,
    'FEATURE_LOOKUP_NOT_IMPLEMENTED',
    'Prediction is not available yet for this customer/product pair: no real ' +
      'interaction-history data source is wired in. The Random Forest model ' +
      'needs 19 real historical features per customer/product pair, and only ' +
      'the raw training dataset exists today (not a live lookup table). ' +
      'Connect a real interaction-history data source before predictions can run.',
    { customerId, itemId, requiredFeatures: REQUIRED_FEATURES }
  );
}

/**
 * Runs the real Random Forest prediction for a given customer/item pair.
 *
 * Once deriveFeaturesForCustomerItem() is wired to a real data source, this
 * should call the packaged model (e.g. a small Python inference service
 * wrapping predict_purchase.py, or an equivalent Node-side port) with the
 * derived 19 features, then map its { purchase_probability, prediction,
 * threshold } response onto the { prediction, confidence } shape the rest of
 * the app (Prediction model, PredictionResult, PredictionTable, etc.) already
 * expects — so no other file needs to change once this is completed.
 */
export async function predictPurchaseForCustomerItem(customerId, itemId) {
  const features = await deriveFeaturesForCustomerItem(customerId, itemId);

  // --- Wire the real model call in here once features are real -------------
  // const { purchase_probability, prediction, threshold } =
  //   await callRandomForestModel(features); // e.g. HTTP call to a Python
  //                                           // service wrapping predict_purchase.py
  //
  // return {
  //   prediction: prediction === 1 ? PREDICTION_LABELS[0] : PREDICTION_LABELS[1],
  //   confidence: Math.round(purchase_probability * 100),
  //   purchaseProbability: purchase_probability,
  //   threshold,
  //   isMock: false,
  // };
  // ---------------------------------------------------------------------------

  return features; // unreachable until deriveFeaturesForCustomerItem is implemented
}
