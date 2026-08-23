import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { AppError } from '../middleware/errorMiddleware.js';
import { getUserProfileStats } from '../services/analyticsService.js';

export async function getProfile(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');

    const stats = await getUserProfileStats(req.user.id);

    // Flat shape matching the old getProfile() mock exactly:
    // { _id, name, email, createdAt, totalPredictions, accuracy }
    res.status(200).json({
      success: true,
      data: { ...user.toPublicJSON(), ...stats },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const { name, email } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');

    // Explicit allow-list — never spread req.body onto the document. Client
    // can never touch _id, passwordHash, isDemo, timestamps, etc.
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    await user.save();

    const stats = await getUserProfileStats(req.user.id);
    res.status(200).json({ success: true, data: { ...user.toPublicJSON(), ...stats } });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select('+passwordHash');
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.status(200).json({ success: true, data: { success: true } });
  } catch (err) {
    next(err);
  }
}
