import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { authLimiter } from '../middleware/rateLimitMiddleware.js';
import { registerSchema, loginSchema } from '../validators/authValidator.js';

const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), authController.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
router.post('/demo', authLimiter, authController.demoLogin);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.getMe);

export default router;
