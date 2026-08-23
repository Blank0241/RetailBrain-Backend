import { PREDICTION_LABELS } from '../models/Prediction.js';

/**
 * ============================================================================
 * MOCK ML SERVICE — NOT A REAL TRAINED MODEL
 * ============================================================================
 * This deterministically scores `inputData` using simple weighted heuristics
 * (intentionally mirroring the frontend's own placeholder formula in the old
 * src/services/api.js mock, so demo behavior stays consistent). This is a
 * stand-in only.
 *
 * When the real RetailBrain model is ready, replace the body of `predict()`
 * below with a call to the actual model (local inference, a Python
 * microservice, a hosted endpoint, etc.) — predictionService.js and
 * predictionController.js do not need to change, because they only depend on
 * this function's { prediction, confidence } contract.
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
