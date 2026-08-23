import { AppError } from './errorMiddleware.js';

/**
 * Wraps a Zod schema. Usage: validate({ body: schema }) or
 * validate({ query: schema }) / validate({ params: schema }).
 * On success, replaces req.body/query/params with the *parsed* (and
 * coerced/defaulted) value so downstream code can trust it.
 */
export function validate({ body, query, params } = {}) {
  return (req, res, next) => {
    try {
      if (body) req.body = body.parse(req.body);
      if (query) req.query = query.parse(req.query);
      if (params) req.params = params.parse(req.params);
      next();
    } catch (err) {
      const details = err.errors?.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })) || [String(err.message)];
      next(new AppError(422, 'VALIDATION_ERROR', 'Invalid request.', details));
    }
  };
}
