import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { isProd } from '../config/env';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ success: false, error: { code: 'not_found', message: 'Resource not found' } });
}

interface MongoDuplicateError {
  code?: number;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'validation_error',
        message: 'Validation failed',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  const maybe = err as MongoDuplicateError;
  if (maybe && maybe.code === 11000) {
    res.status(409).json({
      success: false,
      error: { code: 'conflict', message: 'A record with these values already exists' },
    });
    return;
  }

  if (err instanceof Error && err.name === 'CastError') {
    res.status(400).json({ success: false, error: { code: 'bad_request', message: 'Invalid identifier' } });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: { code: 'internal_error', message: isProd ? 'An unexpected error occurred' : String((err as Error)?.message ?? err) },
  });
}
