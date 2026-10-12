import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { BadRequest } from '../lib/errors';

type Source = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(formatIssue(result.error, source));
    }
    (req as unknown as Record<string, unknown>)[source] = result.data;
    next();
  };
}

export function validateAll(schemas: Partial<Record<Source, ZodSchema>>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    for (const key of Object.keys(schemas) as Source[]) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) return next(formatIssue(result.error, key));
      (req as unknown as Record<string, unknown>)[key] = result.data;
    }
    next();
  };
}

function formatIssue(error: ZodError, source: Source) {
  return BadRequest(
    'Validation failed',
    error.issues.map((i) => ({ path: [source, ...i.path].join('.'), message: i.message })),
  );
}
