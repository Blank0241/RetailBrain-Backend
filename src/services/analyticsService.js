import Prediction from '../models/Prediction.js';
import ModelMetrics from '../models/ModelMetrics.js';

/**
 * All the pure "shape the data for charts" functions below intentionally
 * mirror the frontend's old mockData.js helpers (computeStats,
 * predictionsOverTime, accuracyOverTime, confidenceVsCorrectness,
 * distributionByCategory) field-for-field, since Dashboard.jsx and
 * Analytics.jsx feed their output straight into Recharts components without
 * any reshaping. Reads happen once per request against the authenticated
 * user's own predictions only (never cross-user).
 */

export function computeStats(predictions) {
  const total = predictions.length;
  const correct = predictions.filter((p) => p.status === 'Correct').length;
  const incorrect = predictions.filter((p) => p.status === 'Incorrect').length;
  const pending = predictions.filter((p) => p.status === 'Pending').length;
  const evaluated = correct + incorrect;
  const accuracy = evaluated > 0 ? Math.round((correct / evaluated) * 1000) / 10 : 0;
  return { total, correct, incorrect, pending, evaluated, accuracy };
}

function predictionsOverTime(predictions) {
  const byDay = {};
  predictions.forEach((p) => {
    const d = new Date(p.createdAt);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    byDay[key] = byDay[key] || { date: key, predictions: 0, correct: 0, incorrect: 0 };
    byDay[key].predictions += 1;
    if (p.status === 'Correct') byDay[key].correct += 1;
    if (p.status === 'Incorrect') byDay[key].incorrect += 1;
  });
  return Object.values(byDay).sort((a, b) => {
    const [am, ad] = a.date.split('/').map(Number);
    const [bm, bd] = b.date.split('/').map(Number);
    return am - bm || ad - bd;
  });
}

function accuracyOverTime(predictions) {
  const sorted = [...predictions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  let correct = 0;
  let evaluated = 0;
  const points = [];
  sorted.forEach((p) => {
    if (p.status === 'Correct' || p.status === 'Incorrect') {
      evaluated += 1;
      if (p.status === 'Correct') correct += 1;
      const d = new Date(p.createdAt);
      points.push({
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        accuracy: Math.round((correct / evaluated) * 1000) / 10,
      });
    }
  });
  const step = Math.max(1, Math.floor(points.length / 14));
  return points.filter((_, i) => i % step === 0);
}

function confidenceVsCorrectness(predictions) {
  return predictions
    .filter((p) => p.status !== 'Pending')
    .map((p) => ({
      confidence: p.confidence,
      correct: p.status === 'Correct' ? 1 : 0,
      label: p.status,
    }));
}

function distributionByCategory(predictions) {
  const map = {};
  predictions.forEach((p) => {
    const cat = p.inputData?.productCategory || 'Unknown';
    map[cat] = (map[cat] || 0) + 1;
  });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

async function getUserPredictionsPlain(userId) {
  // .lean() -> plain JS objects, fast, read-only; fine since these are
  // purely aggregated/derived views, never mutated.
  const docs = await Prediction.find({ userId }).sort({ createdAt: -1 }).lean();
  return docs.map((d) => ({ ...d, _id: d._id.toString() }));
}

export async function getDashboardStats(userId) {
  const predictions = await getUserPredictionsPlain(userId);
  return {
    stats: computeStats(predictions),
    predictionsOverTime: predictionsOverTime(predictions),
    accuracyOverTime: accuracyOverTime(predictions),
    recent: predictions.slice(0, 6),
  };
}

export async function getAnalytics(userId) {
  const predictions = await getUserPredictionsPlain(userId);
  const stats = computeStats(predictions);

  return {
    stats,
    accuracyOverTime: accuracyOverTime(predictions),
    predictionsOverTime: predictionsOverTime(predictions),
    confidenceVsCorrectness: confidenceVsCorrectness(predictions),
    distributionByCategory: distributionByCategory(predictions),
    modelMetrics: await recalculateModelMetrics(),
  };
}

/**
 * Recomputes the cached ModelMetrics document from the Predictions
 * collection (source of truth is always Predictions — this is a global,
 * cross-user summary of "the model" as a whole, distinct from any one
 * user's personal stats).
 */
export async function recalculateModelMetrics() {
  const all = await Prediction.find({}).select('status').lean();
  const stats = computeStats(all);

  const updated = await ModelMetrics.findOneAndUpdate(
    { scope: 'global' },
    { ...stats, updatedAt: new Date() },
    { upsert: true, new: true }
  ).lean();

  return {
    _id: updated._id.toString(),
    total: updated.total,
    correct: updated.correct,
    incorrect: updated.incorrect,
    pending: updated.pending,
    evaluated: updated.evaluated,
    accuracy: updated.accuracy,
    updatedAt: updated.updatedAt,
  };
}

export async function getUserProfileStats(userId) {
  const predictions = await Prediction.find({ userId }).select('status').lean();
  const stats = computeStats(predictions);
  return { totalPredictions: stats.total, accuracy: stats.accuracy };
}
