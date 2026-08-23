import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errorMiddleware.js';

export const AUTH_COOKIE_NAME = 'rb_token';

/**
 * Reads the JWT from the httpOnly cookie (primary mechanism — the frontend
 * never attaches an Authorization header), verifies it, and attaches
 * { id } to req.user. req.user.id is the ONLY source of truth for
 * "who is making this request" anywhere downstream — never req.body.userId.
 */
export function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];

    if (!token) {
      throw new AppError(401, 'UNAUTHENTICATED', 'You must be signed in to do this.');
    }

    const payload = jwt.verify(token, env.jwtSecret);
    req.user = { id: payload.sub };
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if (err.name === 'TokenExpiredError') {
      return next(new AppError(401, 'TOKEN_EXPIRED', 'Your session has expired. Please sign in again.'));
    }
    return next(new AppError(401, 'INVALID_TOKEN', 'Your session is invalid. Please sign in again.'));
  }
}

export function signAuthToken(userId) {
  return jwt.sign({ sub: userId.toString() }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

function cookieMaxAgeMs() {
  // jwt expiresIn like "7d" -> approximate ms for the cookie's Max-Age.
  // Cookie expiry is advisory only; the JWT's own exp claim is authoritative.
  const match = /^(\d+)([smhd])$/.exec(env.jwtExpiresIn);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unitMs = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return value * unitMs;
}

export function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProd || env.crossSiteCookies,
    sameSite: env.crossSiteCookies ? 'none' : 'lax',
    maxAge: cookieMaxAgeMs(),
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProd || env.crossSiteCookies,
    sameSite: env.crossSiteCookies ? 'none' : 'lax',
    path: '/',
  });
}
