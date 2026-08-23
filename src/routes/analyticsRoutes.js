import { Router } from 'express';
import * as analyticsController from '../controllers/analyticsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/dashboard', analyticsController.getDashboard);
router.get('/', analyticsController.getAnalytics);

export default router;
