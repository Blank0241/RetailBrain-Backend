import mongoose from 'mongoose';
import Prediction, { PREDICTION_LABELS } from '../models/Prediction.js';
import { AppError } from '../middleware/errorMiddleware.js';
import { predictPurchaseForCustomerItem } from './mlService.js';

export async function createPrediction(userId, inputData) {
  const { customerId, itemId } = inputData;

  // Throws (currently always, until real feature lookup is wired in — see
  // mlService.deriveFeaturesForCustomerItem) rather than ever fabricating a
  // prediction, so no Prediction document is created below on failure.
  const { prediction, confidence } = await predictPurchaseForCustomerItem(customerId, itemId);

  const doc = await Prediction.create({
    userId,
    customer: customerId || 'Unknown Customer',
    inputData,
    prediction,
    confidence,
    actualOutcome: 'Not Known Yet',
    status: 'Pending',
    evaluatedAt: null,
  });

  return doc.toPublicJSON();
}

const SORT_MAP = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  confidence: { confidence: -1 },
};

/**
 * Mirrors the old mock implementation's filtering exactly:
 * - search matches against customer name, the Mongo _id (string form), or
 *   inputData.customerId, case-insensitively
 * - status 'All' means no filter
 * - sortBy: 'newest' | 'oldest' | 'confidence'
 */
export async function listPredictions(userId, { search, status, sortBy, page, pageSize }) {
  const match = { userId: new mongoose.Types.ObjectId(userId) };
  if (status !== 'All') {
    match.status = status;
  }

  const pipeline = [{ $match: match }];

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'i');
    pipeline.push(
      { $addFields: { _idStr: { $toString: '$_id' } } },
      {
        $match: {
          $or: [
            { customer: re },
            { 'inputData.customerId': re },
            { _idStr: re },
          ],
        },
      }
    );
  }

  pipeline.push({
    $facet: {
      data: [
        { $sort: SORT_MAP[sortBy] || SORT_MAP.newest },
        { $skip: (page - 1) * pageSize },
        { $limit: pageSize },
      ],
      totalCount: [{ $count: 'count' }],
    },
  });

  const [result] = await Prediction.aggregate(pipeline);
  const rawItems = result?.data || [];
  const total = result?.totalCount?.[0]?.count || 0;

  const items = rawItems.map((doc) => ({
    _id: doc._id.toString(),
    userId: doc.userId.toString(),
    customer: doc.customer,
    inputData: doc.inputData,
    prediction: doc.prediction,
    confidence: doc.confidence,
    actualOutcome: doc.actualOutcome,
    status: doc.status,
    createdAt: doc.createdAt,
    evaluatedAt: doc.evaluatedAt,
  }));

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getPredictionForUser(userId, predictionId) {
  const doc = await Prediction.findOne({ _id: predictionId, userId });
  if (!doc) {
    throw new AppError(404, 'NOT_FOUND', 'Prediction not found.');
  }
  return doc;
}

export async function getPredictionByIdForUser(userId, predictionId) {
  const doc = await getPredictionForUser(userId, predictionId);
  return doc.toPublicJSON();
}

export async function submitActualOutcome(userId, predictionId, actualOutcome) {
  const doc = await getPredictionForUser(userId, predictionId);

  // Status is ALWAYS computed server-side — never trust a client-supplied
  // status. This mirrors the frontend mock's own comparison logic exactly.
  let status = 'Pending';
  if (actualOutcome !== 'Not Known Yet') {
    const predictedPurchase = doc.prediction === PREDICTION_LABELS[0];
    const actuallyPurchased = actualOutcome === 'Purchased';
    status = predictedPurchase === actuallyPurchased ? 'Correct' : 'Incorrect';
  }

  doc.actualOutcome = actualOutcome;
  doc.status = status;
  doc.evaluatedAt = new Date();
  await doc.save();

  return doc.toPublicJSON();
}
