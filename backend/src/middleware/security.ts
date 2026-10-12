import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { env, isTest } from '../config/env';
import { Forbidden } from '../lib/errors';

export const helmetMiddleware = helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
});

const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((o) => o.trim());

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 100000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'rate_limited', message: 'Too many requests, slow down.' } },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 100000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'rate_limited', message: 'Too many authentication attempts.' } },
});

const CSRF_COOKIE = 'ish_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!env.CSRF_ENABLED || SAFE_METHODS.has(req.method)) return next();
  // Bearer-token requests are not vulnerable to CSRF.
  if (req.headers.authorization?.startsWith('Bearer ')) return next();

  const cookieToken = (req as unknown as { cookies?: Record<string, string> }).cookies?.[CSRF_COOKIE];
  const headerToken = req.headers['x-csrf-token'];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(Forbidden('Invalid CSRF token'));
  }
  next();
}

export function issueCsrfToken(req: Request, res: Response) {
  const existing = (req as unknown as { cookies?: Record<string, string> }).cookies?.[CSRF_COOKIE];
  const token = existing || require('crypto').randomBytes(24).toString('base64url');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: env.COOKIE_SECURE ? 'none' : 'lax',
    secure: env.COOKIE_SECURE,
    path: '/',
  });
  res.json({ success: true, data: { csrfToken: token } });
}

export const CSRF_COOKIE_NAME = CSRF_COOKIE;
