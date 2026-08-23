import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { updateProfileSchema, changePasswordSchema } from '../validators/userValidator.js';

const router = Router();

router.use(requireAuth);

router.get('/me', userController.getProfile);
router.patch('/me', validate({ body: updateProfileSchema }), userController.updateProfile);
router.patch('/me/password', validate({ body: changePasswordSchema }), userController.changePassword);

export default router;
