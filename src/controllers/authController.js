import * as authService from '../services/authService.js';
import { signAuthToken, setAuthCookie, clearAuthCookie } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorMiddleware.js';
import User from '../models/User.js';

function respondWithSession(res, statusCode, user) {
  const token = signAuthToken(user._id);
  setAuthCookie(res, token);

  res.status(statusCode).json({
    success: true,
    data: {
      user: user.toPublicJSON(),
      // Returned for API-contract completeness / non-browser clients even
      // though the shipped React frontend relies on the httpOnly cookie and
      // ignores this field.
      token,
    },
  });
}

export async function register(req, res, next) {
  try {
    const user = await authService.registerUser(req.body);
    respondWithSession(res, 201, user);
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const user = await authService.authenticateUser(req.body);
    respondWithSession(res, 200, user);
  } catch (err) {
    next(err);
  }
}

export async function demoLogin(req, res, next) {
  try {
    const user = await authService.createDemoUser();
    respondWithSession(res, 200, user);
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    clearAuthCookie(res);
    res.status(200).json({ success: true, data: { success: true } });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found.');
    }
    res.status(200).json({ success: true, data: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
}
