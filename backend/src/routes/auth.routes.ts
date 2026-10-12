import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { asyncHandler, ok } from '../lib/http';
import { BadRequest, Unauthorized } from '../lib/errors';
import { validate } from '../middleware/validate';
import { authenticate, optionalAuth } from '../middleware/auth';
import { authLimiter, issueCsrfToken } from '../middleware/security';
import { audit } from '../lib/audit';
import { SchoolMembership, User } from '../models';
import {
  authenticateCredentials,
  consumePasswordReset,
  createPasswordReset,
  getSchoolIds,
  registerStudent,
  signToken,
} from '../services/auth.service';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(120),
  password: z.string().min(8).max(200),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function setSessionCookie(res: import('express').Response, token: string) {
  res.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: env.COOKIE_SECURE ? 'none' : 'lax',
    secure: env.COOKIE_SECURE,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

router.get('/csrf', issueCsrfToken);

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const existing = await User.findOne({ email: req.body.email.toLowerCase() });
    if (existing) throw BadRequest('An account with this email already exists');
    const user = await registerStudent(req.body);
    const token = signToken(user);
    setSessionCookie(res, token);
    await audit({ req, action: 'auth.register', entityType: 'User', entityId: String(user._id) });
    return ok(res, { user: user.toJSON(), token }, 201);
  }),
);

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const user = await authenticateCredentials(req.body.email, req.body.password);
    const token = signToken(user);
    setSessionCookie(res, token);
    const schoolIds = await getSchoolIds(String(user._id));
    await audit({ req, action: 'auth.login', entityType: 'User', entityId: String(user._id) });
    return ok(res, { user: user.toJSON(), token, schoolIds });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (_req, res) => {
    res.clearCookie(env.COOKIE_NAME, { path: '/' });
    return ok(res, { loggedOut: true });
  }),
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const memberships = await SchoolMembership.find({ user: req.auth!.id, status: 'active' }).populate('school', 'name code logoUrl').lean();
    return ok(res, { user: req.auth, memberships });
  }),
);

router.get(
  '/me/full',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth!.id).lean();
    const memberships = await SchoolMembership.find({ user: req.auth!.id }).populate('school', 'name code').lean();
    return ok(res, { user, memberships });
  }),
);

router.post(
  '/forgot-password',
  authLimiter,
  validate(z.object({ email: z.string().email() })),
  asyncHandler(async (req, res) => {
    const token = await createPasswordReset(req.body.email);
    // Never reveal whether the account exists.
    if (token && env.NODE_ENV === 'development') {
      return ok(res, { message: 'Reset link generated', devToken: token });
    }
    return ok(res, { message: 'If the account exists, a reset link has been sent.' });
  }),
);

router.post(
  '/reset-password',
  authLimiter,
  validate(z.object({ token: z.string().min(10), password: z.string().min(8).max(200) })),
  asyncHandler(async (req, res) => {
    await consumePasswordReset(req.body.token, req.body.password);
    return ok(res, { message: 'Password updated' });
  }),
);

router.get(
  '/me/schools',
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (!req.auth) throw Unauthorized();
    const schoolIds = await getSchoolIds(req.auth.id);
    return ok(res, { schoolIds });
  }),
);

export default router;
