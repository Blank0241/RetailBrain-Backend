import * as predictionService from '../services/predictionService.js';

export async function createPrediction(req, res, next) {
  try {
    const { inputData } = req.body;
    const prediction = await predictionService.createPrediction(req.user.id, inputData);
    res.status(201).json({ success: true, data: prediction });
  } catch (err) {
    next(err);
  }
}

export async function getHistory(req, res, next) {
  try {
    const result = await predictionService.listPredictions(req.user.id, req.query);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const prediction = await predictionService.getPredictionByIdForUser(req.user.id, req.params.id);
    res.status(200).json({ success: true, data: prediction });
  } catch (err) {
    next(err);
  }
}

export async function submitOutcome(req, res, next) {
  try {
    const { actualOutcome } = req.body;
    const prediction = await predictionService.submitActualOutcome(req.user.id, req.params.id, actualOutcome);
    res.status(200).json({ success: true, data: prediction });
  } catch (err) {
    next(err);
  }
}
