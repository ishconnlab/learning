import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { asyncHandler, ok } from '../lib/http';
import { NotFound } from '../lib/errors';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { audit } from '../lib/audit';
import { CMSPage, CMSRevision } from '../models';

const router = Router();

router.get(
  '/pages',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const staff = req.auth && ['platform_admin', 'platform_owner'].includes(req.auth.role);
    if (staff) {
      const pages = await CMSPage.find().select('key title status publishedAt updatedAt currentRevision').lean();
      return ok(res, pages);
    }
    const pages = await CMSPage.find({ status: 'published' }).select('key title publishedContent seo publishedAt').lean();
    return ok(res, pages);
  }),
);

router.get(
  '/pages/:key',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const page = await CMSPage.findOne({ key: req.params.key }).lean();
    if (!page) throw NotFound('Page not found');
    const staff = req.auth && ['platform_admin', 'platform_owner'].includes(req.auth.role);
    if (!staff) {
      if (page.status !== 'published') throw NotFound('Page not found');
      return ok(res, { key: page.key, title: page.title, content: page.publishedContent, seo: page.seo });
    }
    return ok(res, page);
  }),
);

router.put(
  '/pages/:key',
  authenticate,
  authorize('platform_admin', 'platform_owner'),
  validate(
    z.object({
      title: z.string().optional(),
      content: z.record(z.unknown()).optional(),
      seo: z.record(z.unknown()).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    let page = await CMSPage.findOne({ key: req.params.key });
    if (!page) {
      page = await CMSPage.create({
        key: req.params.key,
        title: req.body.title || req.params.key,
        draftContent: req.body.content || {},
        seo: req.body.seo || {},
        updatedBy: req.auth!.id,
      });
    } else {
      if (req.body.title) page.title = req.body.title;
      if (req.body.content) page.draftContent = req.body.content;
      if (req.body.seo) Object.assign(page.seo, req.body.seo);
      page.updatedBy = new Types.ObjectId(req.auth!.id);
    }
    page.currentRevision = (page.currentRevision || 0) + 1;
    await page.save();
    await CMSRevision.create({
      page: page._id,
      pageKey: page.key,
      revision: page.currentRevision,
      content: page.draftContent,
      seo: page.seo,
    });
    await audit({ req, action: 'cms.update', entityType: 'CMSPage', entityId: String(page._id) });
    return ok(res, page);
  }),
);

router.post(
  '/pages/:key/publish',
  authenticate,
  authorize('platform_admin', 'platform_owner'),
  asyncHandler(async (req, res) => {
    const page = await CMSPage.findOne({ key: req.params.key });
    if (!page) throw NotFound('Page not found');
    page.publishedContent = page.draftContent;
    page.status = 'published';
    page.publishedAt = new Date();
    await page.save();
    await audit({ req, action: 'cms.publish', entityType: 'CMSPage', entityId: String(page._id) });
    return ok(res, page);
  }),
);

router.post(
  '/pages/:key/unpublish',
  authenticate,
  authorize('platform_admin', 'platform_owner'),
  asyncHandler(async (req, res) => {
    const page = await CMSPage.findOneAndUpdate({ key: req.params.key }, { $set: { status: 'draft' } }, { new: true });
    if (!page) throw NotFound('Page not found');
    await audit({ req, action: 'cms.unpublish', entityType: 'CMSPage', entityId: String(page._id) });
    return ok(res, page);
  }),
);

router.get(
  '/pages/:key/revisions',
  authenticate,
  authorize('platform_admin', 'platform_owner'),
  asyncHandler(async (req, res) => {
    const page = await CMSPage.findOne({ key: req.params.key }).lean();
    if (!page) throw NotFound('Page not found');
    const revisions = await CMSRevision.find({ page: page._id }).sort({ revision: -1 }).lean();
    return ok(res, revisions);
  }),
);

router.post(
  '/pages/:key/restore/:revision',
  authenticate,
  authorize('platform_admin', 'platform_owner'),
  asyncHandler(async (req, res) => {
    const page = await CMSPage.findOne({ key: req.params.key });
    if (!page) throw NotFound('Page not found');
    const revision = await CMSRevision.findOne({ page: page._id, revision: Number(req.params.revision) }).lean();
    if (!revision) throw NotFound('Revision not found');
    page.draftContent = revision.content;
    page.seo = revision.seo as typeof page.seo;
    page.updatedBy = new Types.ObjectId(req.auth!.id);
    await page.save();
    await audit({ req, action: 'cms.restore', entityType: 'CMSPage', entityId: String(page._id) });
    return ok(res, page);
  }),
);

export default router;
