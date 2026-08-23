import { env } from '../config/env.js';

export class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function notFoundHandler(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong.';
  let details = err.details;

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed.';
    details = Object.values(err.errors).map((e) => e.message);
  }

  // Mongo duplicate key (e.g. duplicate email)
  if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `That ${field} is already in use.`;
  }

  // Invalid ObjectId cast
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Invalid identifier.';
  }

  // JWT errors that slipped through
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
    message = 'Your session is invalid or has expired.';
  }

  if (statusCode >= 500) {
    // Server-side logging only — never sent to the client.
    console.error('[error]', err);
  }

  const body = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };

  // Never leak stack traces or internals in production.
  if (!env.isProd && statusCode >= 500) {
    body.error.stack = err.stack;
  }

  res.status(statusCode).json(body);
}
