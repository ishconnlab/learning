import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok, paginated, parsePagination } from '../lib/http';
import { NotFound } from '../lib/errors';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { audit } from '../lib/audit';
import { Notification, User } from '../models';

const router = Router();
router.use(authenticate);

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth!.id).lean();
    if (!user) throw NotFound('User not found');
    const unread = await Notification.countDocuments({ user: req.auth!.id, read: false });
    return ok(res, { ...user, unreadNotifications: unread });
  }),
);

router.patch(
  '/me',
  validate(
    z.object({
      name: z.string().min(2).optional(),
      phone: z.string().optional(),
      preferredLanguage: z.string().optional(),
      avatarUrl: z.string().url().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.auth!.id, { $set: req.body }, { new: true });
    return ok(res, user);
  }),
);

router.get(
  '/',
  authorize('platform_admin', 'platform_owner'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter: Record<string, unknown> = {};
    if (req.query.role) filter.role = String(req.query.role);
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.q) {
      const rx = new RegExp(String(req.query.q), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }
    const [items, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);
    return paginated(res, items, { page, limit, total });
  }),
);

router.patch(
  '/:id/role',
  authorize('platform_admin', 'platform_owner'),
  validate(z.object({ role: z.enum(['platform_owner', 'platform_admin', 'school_admin', 'teacher', 'student']) })),
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.params.id, { $set: { role: req.body.role } }, { new: true });
    if (!user) throw NotFound('User not found');
    await audit({ req, action: 'user.role_change', entityType: 'User', entityId: String(user._id), severity: 'warning', metadata: { role: req.body.role } });
    return ok(res, user);
  }),
);

router.patch(
  '/:id/status',
  authorize('platform_admin', 'platform_owner'),
  validate(z.object({ status: z.enum(['active', 'suspended', 'invited']) })),
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true });
    if (!user) throw NotFound('User not found');
    await audit({ req, action: 'user.status_change', entityType: 'User', entityId: String(user._id), severity: 'warning', metadata: { status: req.body.status } });
    return ok(res, user);
  }),
);

router.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter: Record<string, unknown> = { user: req.auth!.id };
    if (req.query.unread === 'true') filter.read = false;
    const [items, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
    ]);
    return paginated(res, items, { page, limit, total });
  }),
);

router.post(
  '/notifications/read-all',
  asyncHandler(async (req, res) => {
    await Notification.updateMany({ user: req.auth!.id, read: false }, { $set: { read: true } });
    return ok(res, { read: true });
  }),
);

router.post(
  '/notifications/:id/read',
  asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.auth!.id },
      { $set: { read: true } },
      { new: true },
    );
    if (!notification) throw NotFound('Notification not found');
    return ok(res, notification);
  }),
);

export default router;
