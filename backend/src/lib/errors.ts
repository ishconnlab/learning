export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(message: string, statusCode = 500, code = 'internal_error', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }
}

export const BadRequest = (msg = 'Bad request', details?: unknown) =>
  new AppError(msg, 400, 'bad_request', details);

export const Unauthorized = (msg = 'Authentication required') => new AppError(msg, 401, 'unauthorized');

export const Forbidden = (msg = 'You do not have permission to perform this action') =>
  new AppError(msg, 403, 'forbidden');

export const NotFound = (msg = 'Resource not found') => new AppError(msg, 404, 'not_found');

export const Conflict = (msg = 'Resource conflict', details?: unknown) =>
  new AppError(msg, 409, 'conflict', details);

export const TooMany = (msg = 'Too many requests') => new AppError(msg, 429, 'rate_limited');

export const Unprocessable = (msg = 'Unprocessable entity', details?: unknown) =>
  new AppError(msg, 422, 'unprocessable_entity', details);
