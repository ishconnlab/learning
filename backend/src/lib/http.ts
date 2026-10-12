import { NextFunction, Request, RequestHandler, Response } from 'express';

/** Wrap an async handler so rejected promises reach the error middleware. */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ success: true, data });
}

export function created<T>(res: Response, data: T): Response {
  return res.status(201).json({ success: true, data });
}

export function paginated<T>(
  res: Response,
  items: T[],
  meta: { page: number; limit: number; total: number },
): Response {
  return res.json({
    success: true,
    data: items,
    meta: { ...meta, pages: Math.max(1, Math.ceil(meta.total / meta.limit)) },
  });
}

export function parsePagination(query: Record<string, unknown>, maxLimit = 100) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
