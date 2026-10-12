import { Router } from 'express';
import { asyncHandler, ok, paginated, parsePagination } from '../lib/http';
import { Forbidden, NotFound } from '../lib/errors';
import { authenticate, authorize } from '../middleware/auth';
import {
  Assessment,
  AssessmentAttempt,
  AuditLog,
  Certificate,
  Course,
  Enrollment,
  School,
  StudentProgress,
  User,
} from '../models';

const router = Router();
router.use(authenticate);

router.get(
  '/platform',
  authorize('platform_admin', 'platform_owner'),
  asyncHandler(async (_req, res) => {
    const [usersByRole, schools, courses, enrollments, completed, certificates, avgCompletion] = await Promise.all([

      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      School.countDocuments(),
      Course.countDocuments({ status: 'published' }),
      Enrollment.countDocuments(),
      Enrollment.countDocuments({ status: 'completed' }),
      Certificate.countDocuments({ status: 'issued' }),
      StudentProgress.aggregate([{ $group: { _id: null, avg: { $avg: '$completionPercent' } } }]),
    ]);
    return ok(res, {
      usersByRole,
      schools,
      publishedCourses: courses,
      enrollments,
      completedEnrollments: completed,
      issuedCertificates: certificates,
      averageCompletionPercent: Math.round(avgCompletion[0]?.avg || 0),
    });
  }),
);

router.get(
  '/course/:courseId',
  authorize('platform_admin', 'platform_owner', 'school_admin', 'teacher'),
  asyncHandler(async (req, res) => {
    const course = await Course.findById(req.params.courseId).lean();
    if (!course) throw NotFound('Course not found');
    const enrollments = await Enrollment.find({ course: course._id }).lean();
    const enrollmentIds = enrollments.map((e) => e._id);
    const assessments = await Assessment.find({ course: course._id }).select('title passMarkPercent').lean();
    const attemptAgg = await AssessmentAttempt.aggregate<{
      _id: string;
      avgPercent: number;
      attempts: number;
      passed: number;
    }>([
      { $match: { course: course._id, status: 'graded' } },
      { $group: { _id: '$assessment', avgPercent: { $avg: '$percent' }, attempts: { $sum: 1 }, passed: { $sum: { $cond: ['$passed', 1, 0] } } } },
    ]);
    const byAssessment = new Map(assessments.map((a) => [String(a._id), a]));
    const assessmentSummary = attemptAgg.map((row) => ({
      assessmentId: String(row._id),
      title: byAssessment.get(String(row._id))?.title ?? 'Assessment',
      passMarkPercent: byAssessment.get(String(row._id))?.passMarkPercent ?? 60,
      attempts: row.attempts,
      passed: row.passed,
      averagePercent: Math.round(row.avgPercent || 0),
    }));

    const avgRow =
      enrollmentIds.length > 0
        ? await StudentProgress.aggregate<{ avg: number }>([
            { $match: { enrollment: { $in: enrollmentIds } } },
            { $group: { _id: null, avg: { $avg: '$completionPercent' } } },
          ])
        : [];
    const averageCompletionPercent = Math.round(avgRow[0]?.avg || 0);

    return ok(res, {
      course: { id: String(course._id), title: course.title, level: course.level },
      enrollmentCount: enrollments.length,
      completedCount: enrollments.filter((e) => e.status === 'completed').length,
      averageCompletionPercent,
      assessmentSummary,
    });
  }),
);

router.get(
  '/audit',
  authorize('platform_admin', 'platform_owner'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter: Record<string, unknown> = {};
    if (req.query.action) filter.action = String(req.query.action);
    if (req.query.severity) filter.severity = String(req.query.severity);
    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);
    return paginated(res, items, { page, limit, total });
  }),
);

router.get(
  '/enrollment/:enrollmentId',
  asyncHandler(async (req, res) => {
    const enrollment = await Enrollment.findById(req.params.enrollmentId).populate('student', 'name email').populate('course', 'title level').lean();
    if (!enrollment) throw NotFound('Enrollment not found');
    const staff = ['platform_admin', 'platform_owner', 'school_admin', 'teacher'].includes(req.auth!.role);
    if (!staff && String(enrollment.student && (enrollment.student as { _id?: unknown })._id) !== req.auth!.id) {
      throw Forbidden();
    }
    const progress = await StudentProgress.findOne({ enrollment: enrollment._id }).lean();
    const attempts = await AssessmentAttempt.find({ enrollment: enrollment._id }).select('-answers').lean();
    return ok(res, { enrollment, progress, attempts });
  }),
);

export default router;
