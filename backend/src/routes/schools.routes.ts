import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, created, ok, paginated, parsePagination } from '../lib/http';
import { Conflict, Forbidden, NotFound } from '../lib/errors';
import { authenticate, authorize, isPlatformAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { audit } from '../lib/audit';
import { Course, Enrollment, School, SchoolMembership, StudentProgress, User } from '../models';
import { createUserWithRole } from '../services/auth.service';
import { ensureProgress } from '../services/progress.service';
import { schoolCode } from '../lib/ids';

const router = Router();
router.use(authenticate);

function assertSchoolAccess(userId: string, role: string, schoolIds: string[], schoolId: string) {
  if (isPlatformAdmin(role)) return;
  if (!schoolIds.includes(schoolId)) throw Forbidden('You cannot access this school');
}

router.post(
  '/',
  authorize('platform_admin', 'platform_owner'),
  validate(
    z.object({
      name: z.string().min(2),
      type: z.enum(['tvet', 'secondary', 'university', 'training_center', 'other']).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      district: z.string().optional(),
      province: z.string().optional(),
      admin: z
        .object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8) })
        .optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const school = await School.create({
      name: req.body.name,
      code: schoolCode(req.body.name),
      type: req.body.type || 'tvet',
      email: req.body.email,
      phone: req.body.phone,
      district: req.body.district,
      province: req.body.province,
      createdBy: req.auth!.id,
    });

    if (req.body.admin) {
      let adminUser = await User.findOne({ email: req.body.admin.email.toLowerCase() });
      if (!adminUser) {
        adminUser = await createUserWithRole({ ...req.body.admin, role: 'school_admin' });
      }
      await SchoolMembership.create({
        user: adminUser._id,
        school: school._id,
        role: 'school_admin',
        status: 'active',
        invitedBy: req.auth!.id,
        joinedAt: new Date(),
      });
    }

    await audit({ req, action: 'school.create', entityType: 'School', entityId: String(school._id) });
    return created(res, school);
  }),
);

router.get(
  '/',
  authorize('platform_admin', 'platform_owner'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter: Record<string, unknown> = {};
    if (req.query.q) filter.name = new RegExp(String(req.query.q), 'i');
    const [items, total] = await Promise.all([
      School.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      School.countDocuments(filter),
    ]);
    return paginated(res, items, { page, limit, total });
  }),
);

router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const memberships = await SchoolMembership.find({ user: req.auth!.id, status: 'active' }).populate('school').lean();
    return ok(res, memberships);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    assertSchoolAccess(req.auth!.id, req.auth!.role, req.auth!.schoolIds, String(req.params.id));
    const school = await School.findById(req.params.id).lean();
    if (!school) throw NotFound('School not found');
    return ok(res, school);
  }),
);

router.get(
  '/:id/members',
  asyncHandler(async (req, res) => {
    assertSchoolAccess(req.auth!.id, req.auth!.role, req.auth!.schoolIds, String(req.params.id));
    const members = await SchoolMembership.find({ school: req.params.id })
      .populate('user', 'name email role status')
      .lean();
    return ok(res, members);
  }),
);

router.post(
  '/:id/members',
  authorize('platform_admin', 'platform_owner', 'school_admin'),
  validate(
    z.object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8).optional(),
      role: z.enum(['school_admin', 'teacher', 'student']),
      title: z.string().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const schoolId = String(req.params.id);
    assertSchoolAccess(req.auth!.id, req.auth!.role, req.auth!.schoolIds, schoolId);
    const school = await School.findById(schoolId);
    if (!school) throw NotFound('School not found');

    let user = await User.findOne({ email: req.body.email.toLowerCase() });
    if (!user) {
      if (!req.body.password) throw Conflict('A password is required to create a new user');
      user = await createUserWithRole({
        email: req.body.email,
        name: req.body.name,
        password: req.body.password,
        role: req.body.role === 'student' ? 'student' : req.body.role === 'teacher' ? 'teacher' : 'school_admin',
      });
    }

    const existing = await SchoolMembership.findOne({ user: user._id, school: school._id });
    if (existing) throw Conflict('This user is already a member of the school');

    const membership = await SchoolMembership.create({
      user: user._id,
      school: school._id,
      role: req.body.role,
      title: req.body.title,
      status: 'active',
      invitedBy: req.auth!.id,
      joinedAt: new Date(),
    });
    await audit({ req, action: 'school.member.add', entityType: 'SchoolMembership', entityId: String(membership._id), school: schoolId });
    return created(res, membership);
  }),
);

router.post(
  '/:id/enroll',
  authorize('platform_admin', 'platform_owner', 'school_admin'),
  validate(z.object({ studentId: z.string(), courseId: z.string() })),
  asyncHandler(async (req, res) => {
    const schoolId = String(req.params.id);
    assertSchoolAccess(req.auth!.id, req.auth!.role, req.auth!.schoolIds, schoolId);
    const studentMembership = await SchoolMembership.findOne({ user: req.body.studentId, school: schoolId, status: 'active' });
    if (!studentMembership) throw Forbidden('Student is not an active member of this school');
    const course = await Course.findById(req.body.courseId).lean();
    if (!course || course.status !== 'published') throw NotFound('Course not available');

    const existing = await Enrollment.findOne({ student: req.body.studentId, course: course._id });
    if (existing) throw Conflict('Student is already enrolled in this course');

    const enrollment = await Enrollment.create({
      student: req.body.studentId,
      course: course._id,
      school: schoolId,
      status: 'active',
      source: 'school',
      enrolledBy: req.auth!.id,
      enrolledAt: new Date(),
    });
    await ensureProgress(String(enrollment._id));
    await audit({ req, action: 'school.enroll', entityType: 'Enrollment', entityId: String(enrollment._id), school: schoolId });
    return created(res, enrollment);
  }),
);

router.get(
  '/:id/reports',
  authorize('platform_admin', 'platform_owner', 'school_admin', 'teacher'),
  asyncHandler(async (req, res) => {
    const schoolId = String(req.params.id);
    assertSchoolAccess(req.auth!.id, req.auth!.role, req.auth!.schoolIds, schoolId);
    const enrollments = await Enrollment.find({ school: schoolId }).populate('student', 'name email').populate('course', 'title level').lean();
    const progress = await StudentProgress.find({ enrollment: { $in: enrollments.map((e) => e._id) } }).lean();
    const byEnrollment = new Map(progress.map((p) => [String(p.enrollment), p]));
    const rows = enrollments.map((e) => ({
      enrollmentId: String(e._id),
      student: e.student,
      course: e.course,
      status: e.status,
      completionPercent: byEnrollment.get(String(e._id))?.completionPercent ?? 0,
      certificateEligible: byEnrollment.get(String(e._id))?.certificateEligible ?? false,
    }));
    return ok(res, { count: rows.length, rows });
  }),
);

router.post(
  '/:id/courses/:courseId/assign-teacher',
  authorize('platform_admin', 'platform_owner', 'school_admin'),
  validate(z.object({ teacherId: z.string() })),
  asyncHandler(async (req, res) => {
    const schoolId = String(req.params.id);
    assertSchoolAccess(req.auth!.id, req.auth!.role, req.auth!.schoolIds, schoolId);
    const membership = await SchoolMembership.findOne({ user: req.body.teacherId, school: schoolId, role: 'teacher', status: 'active' });
    if (!membership) throw Forbidden('User is not an active teacher of this school');
    const { ClassGroup } = await import('../models');
    const klass = await ClassGroup.findOneAndUpdate(
      { school: schoolId, courses: req.params.courseId },
      { $addToSet: { teachers: req.body.teacherId } },
      { new: true },
    );
    await audit({ req, action: 'school.assign_teacher', entityType: 'Course', entityId: String(req.params.courseId), school: schoolId });
    return ok(res, { assigned: true, classGroup: klass });
  }),
);

export default router;
