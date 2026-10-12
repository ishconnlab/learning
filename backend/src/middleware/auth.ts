import { Forbidden, Unauthorized } from '../lib/errors';
import { Role } from '../models/enums';
import { User } from '../models/User';
import { getSchoolIds, verifyToken } from '../services/auth.service';

function extractToken(req: import('express').Request): string | null {
  const cookieName = process.env.COOKIE_NAME || 'ish_session';
  const fromCookie = (req as unknown as { cookies?: Record<string, string> }).cookies?.[cookieName];
  if (fromCookie) return fromCookie;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export async function authenticate(req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) throw Unauthorized();
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub).lean();
    if (!user) throw Unauthorized('Account not found');
    if (user.status === 'suspended') throw Unauthorized('Account suspended');
    const schoolIds = await getSchoolIds(String(user._id));
    req.auth = {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      schoolIds,
    };
    next();
  } catch (err) {
    if (err instanceof Error && err.name === 'JsonWebTokenError') {
      return next(Unauthorized('Invalid session'));
    }
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      return next(Unauthorized('Session expired'));
    }
    next(err);
  }
}

/** Attach auth if a valid token exists, but never reject. */
export async function optionalAuth(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) {
  if (!extractToken(req)) return next();
  return authenticate(req, res, (err?: unknown) => next(err));
}

export function authorize(...roles: Role[]) {
  return (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
    if (!req.auth) return next(Unauthorized());
    if (!roles.includes(req.auth.role)) return next(Forbidden());
    next();
  };
}

export function isPlatformAdmin(role: string): boolean {
  return role === 'platform_admin' || role === 'platform_owner';
}

/** Ensure the caller can operate within the given school (platform staff bypass). */
export function assertSchoolAccess(req: import('express').Request, schoolId?: string) {
  if (!req.auth) throw Unauthorized();
  if (isPlatformAdmin(req.auth.role)) return;
  if (!schoolId || !req.auth.schoolIds.includes(String(schoolId))) {
    throw Forbidden('You do not have access to this school');
  }
}

export function requirePlatformAdmin(req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) {
  if (!req.auth) return next(Unauthorized());
  if (!isPlatformAdmin(req.auth.role)) return next(Forbidden());
  next();
}
