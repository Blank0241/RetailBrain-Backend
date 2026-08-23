import { Router } from 'express';
import * as predictionController from '../controllers/predictionController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  createPredictionSchema,
  submitOutcomeSchema,
  historyQuerySchema,
  objectIdParamSchema,
} from '../validators/predictionValidator.js';

const router = Router();

router.use(requireAuth);

router.post('/', validate({ body: createPredictionSchema }), predictionController.createPrediction);
router.get('/', validate({ query: historyQuerySchema }), predictionController.getHistory);
router.get('/:id', validate({ params: objectIdParamSchema }), predictionController.getById);
router.patch(
  '/:id/outcome',
  validate({ params: objectIdParamSchema, body: submitOutcomeSchema }),
  predictionController.submitOutcome
);

export default router;
