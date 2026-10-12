import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../lib/http';
import { Forbidden, NotFound } from '../lib/errors';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { audit } from '../lib/audit';
import { Certificate, Enrollment } from '../models';
import { storage } from '../services/storage';
import { getBranding, issueCertificate, reissueCertificate, revokeCertificate, verifyCertificate } from '../services/certificate.service';

const router = Router();

// Public verification — no authentication required.
router.get(
  '/verify/:certificateId',
  asyncHandler(async (req, res) => {
    const result = await verifyCertificate(String(req.params.certificateId));
    return ok(res, result);
  }),
);

router.get('/branding', asyncHandler(async (_req, res) => ok(res, await getBranding())));

router.use(authenticate);

router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const certificates = await Certificate.find({ student: req.auth!.id }).sort({ issuedAt: -1 }).lean();
    return ok(res, certificates);
  }),
);

router.get(
  '/',
  authorize('platform_admin', 'platform_owner'),
  asyncHandler(async (_req, res) => {
    const certificates = await Certificate.find().sort({ issuedAt: -1 }).limit(200).lean();
    return ok(res, certificates);
  }),
);

router.get(
  '/:certificateId/pdf',
  asyncHandler(async (req, res) => {
    const cert = await Certificate.findOne({ certificateId: String(req.params.certificateId) }).lean();
    if (!cert) throw NotFound('Certificate not found');
    const staff = ['platform_admin', 'platform_owner', 'school_admin'].includes(req.auth!.role);
    if (!staff && String(cert.student) !== req.auth!.id) throw Forbidden();
    if (!cert.pdfKey) throw NotFound('Certificate file not available');
    const buffer = await storage().get(cert.pdfKey);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${cert.certificateId}.pdf"`);
    res.send(buffer);
  }),
);

router.post(
  '/issue',
  authorize('platform_admin', 'platform_owner'),
  validate(z.object({ enrollmentId: z.string() })),
  asyncHandler(async (req, res) => {
    const cert = await issueCertificate(req.body.enrollmentId, req.auth!.id);
    await audit({ req, action: 'certificate.issue', entityType: 'Certificate', entityId: String(cert._id) });
    return ok(res, cert, 201);
  }),
);

router.post(
  '/:certificateId/revoke',
  authorize('platform_admin', 'platform_owner'),
  validate(z.object({ reason: z.string().min(3) })),
  asyncHandler(async (req, res) => {
    const cert = await revokeCertificate(String(req.params.certificateId), req.body.reason, req.auth!.id);
    await audit({ req, action: 'certificate.revoke', entityType: 'Certificate', entityId: String(cert._id), severity: 'warning' });
    return ok(res, cert);
  }),
);

router.post(
  '/:certificateId/reissue',
  authorize('platform_admin', 'platform_owner'),
  validate(z.object({ reason: z.string().min(3) })),
  asyncHandler(async (req, res) => {
    const cert = await reissueCertificate(String(req.params.certificateId), req.body.reason, req.auth!.id);
    await audit({ req, action: 'certificate.reissue', entityType: 'Certificate', entityId: String(cert._id), severity: 'warning' });
    return ok(res, cert);
  }),
);

router.post(
  '/:certificateId/request',
  asyncHandler(async (req, res) => {
    // A student may request issuance for their own eligible enrollment; issuance is still server-enforced.
    const enrollment = await Enrollment.findOne({ student: req.auth!.id, status: 'completed' }).sort({ completedAt: -1 }).lean();
    if (!enrollment) throw NotFound('No completed enrollment found');
    const cert = await issueCertificate(String(enrollment._id), req.auth!.id);
    return ok(res, cert, 201);
  }),
);

export default router;
