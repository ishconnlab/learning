import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, created, ok } from '../lib/http';
import { BadRequest, Conflict, Forbidden, NotFound } from '../lib/errors';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { audit } from '../lib/audit';
import { Course, Enrollment } from '../models';
import { ensureProgress, getProgressForEnrollment } from '../services/progress.service';

const router = Router();

router.use(authenticate);

router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const enrollments = await Enrollment.find({ student: req.auth!.id })
      .populate('course')
      .sort({ createdAt: -1 })
      .lean();
    return ok(res, enrollments);
  }),
);

router.post(
  '/',
  validate(z.object({ courseId: z.string().min(3) })),
  asyncHandler(async (req, res) => {
    const course = await Course.findById(req.body.courseId).lean();
    if (!course || course.status !== 'published') throw NotFound('Course not available');
    const existing = await Enrollment.findOne({ student: req.auth!.id, course: course._id });
    if (existing) throw Conflict('You are already enrolled in this course');
    if (req.auth!.role !== 'student') throw Forbidden('Only students can self-enroll');

    const enrollment = await Enrollment.create({
      student: req.auth!.id,
      course: course._id,
      status: 'active',
      source: 'self',
      enrolledAt: new Date(),
    });
    await ensureProgress(String(enrollment._id));
    await audit({ req, action: 'enrollment.self', entityType: 'Enrollment', entityId: String(enrollment._id) });
    return created(res, enrollment);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const enrollment = await Enrollment.findById(req.params.id).populate('course').lean();
    if (!enrollment) throw NotFound('Enrollment not found');
    const isOwner = String(enrollment.student) === req.auth!.id;
    const isStaff = ['platform_admin', 'platform_owner', 'teacher', 'school_admin'].includes(req.auth!.role);
    if (!isOwner && !isStaff) throw Forbidden();
    return ok(res, enrollment);
  }),
);

router.get(
  '/:id/progress',
  asyncHandler(async (req, res) => {
    const enrollment = await Enrollment.findById(req.params.id).lean();
    if (!enrollment) throw NotFound('Enrollment not found');
    if (String(enrollment.student) !== req.auth!.id && !['platform_admin', 'platform_owner', 'teacher', 'school_admin'].includes(req.auth!.role)) {
      throw Forbidden();
    }
    const progress = await getProgressForEnrollment(String(enrollment._id));
    return ok(res, progress);
  }),
);

router.post(
  '/:id/complete',
  authorize('platform_admin', 'platform_owner', 'teacher', 'school_admin'),
  asyncHandler(async (req, res) => {
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment) throw NotFound('Enrollment not found');
    const progress = await getProgressForEnrollment(String(enrollment._id));
    if (!progress.certificateEligible) throw BadRequest('Completion requirements are not satisfied');
    enrollment.status = 'completed';
    enrollment.completedAt = new Date();
    enrollment.completedVersion = (await Course.findById(enrollment.course).lean())?.activeVersion ?? undefined;
    await enrollment.save();
    await audit({ req, action: 'enrollment.complete', entityType: 'Enrollment', entityId: String(enrollment._id) });
    return ok(res, enrollment);
  }),
);

export default router;
