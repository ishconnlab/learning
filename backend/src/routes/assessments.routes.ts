import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, created, ok, paginated, parsePagination } from '../lib/http';
import { BadRequest, NotFound } from '../lib/errors';
import { authenticate, authorize, isPlatformAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { audit } from '../lib/audit';
import { Assessment, Course, Enrollment, Question } from '../models';
import {
  getAssessmentForStudent,
  getAttemptResult,
  staffPreview,
  startAttempt,
  submitAttempt,
} from '../services/assessment.service';

const router = Router();
router.use(authenticate);

const staffRoles = ['platform_admin', 'platform_owner', 'teacher'] as const;

async function assertCourseAccess(courseId: string, userId: string, role: string) {
  if (isPlatformAdmin(role) || role === 'teacher') return;
  const enrolled = await Enrollment.findOne({ student: userId, course: courseId });
  if (!enrolled) throw BadRequest('You do not have access to this course');
}

// -------- Student endpoints --------

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await getAssessmentForStudent(String(req.params.id), req.auth!.id);
    return ok(res, data);
  }),
);

router.post(
  '/:id/attempts',
  validate(z.object({ clientAttemptId: z.string().min(6) })),
  asyncHandler(async (req, res) => {
    const data = await startAttempt(String(req.params.id), req.auth!.id, req.body.clientAttemptId);
    return created(res, data);
  }),
);

router.post(
  '/attempts/:attemptId/submit',
  validate(
    z.object({
      answers: z.array(z.object({ questionId: z.string(), selectedOptionId: z.string() })),
      clientAttemptId: z.string().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const result = await submitAttempt({
      attemptId: String(req.params.attemptId),
      studentId: req.auth!.id,
      answers: req.body.answers,
      clientAttemptId: req.body.clientAttemptId,
    });
    return ok(res, result);
  }),
);

router.get(
  '/attempts/:attemptId',
  asyncHandler(async (req, res) => {
    const data = await getAttemptResult(String(req.params.attemptId), req.auth!.id);
    return ok(res, data);
  }),
);

// -------- Staff endpoints --------

router.get(
  '/:id/preview',
  authorize(...staffRoles),
  asyncHandler(async (req, res) => {
    const data = await staffPreview(String(req.params.id));
    return ok(res, data);
  }),
);

router.post(
  '/',
  authorize(...staffRoles),
  validate(
    z.object({
      courseId: z.string(),
      moduleId: z.string().optional(),
      title: z.string().min(3),
      instructions: z.string().optional(),
      questionIds: z.array(z.string()).default([]),
      passMarkPercent: z.number().min(0).max(100).optional(),
      attemptsAllowed: z.number().min(1).optional(),
      timeLimitMinutes: z.number().min(1).optional(),
      randomizeQuestions: z.boolean().optional(),
      randomizeOptions: z.boolean().optional(),
      offlineAllowed: z.boolean().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const course = await Course.findById(req.body.courseId).lean();
    if (!course) throw NotFound('Course not found');
    await assertCourseAccess(String(course._id), req.auth!.id, req.auth!.role);
    const assessment = await Assessment.create({
      course: course._id,
      module: req.body.moduleId,
      title: req.body.title,
      instructions: req.body.instructions || '',
      questions: req.body.questionIds || [],
      passMarkPercent: req.body.passMarkPercent ?? 60,
      attemptsAllowed: req.body.attemptsAllowed ?? 3,
      timeLimitMinutes: req.body.timeLimitMinutes,
      randomizeQuestions: req.body.randomizeQuestions ?? true,
      randomizeOptions: req.body.randomizeOptions ?? true,
      offlineAllowed: req.body.offlineAllowed ?? false,
      status: 'draft',
      createdBy: req.auth!.id,
    });
    await audit({ req, action: 'assessment.create', entityType: 'Assessment', entityId: String(assessment._id) });
    return created(res, assessment);
  }),
);

router.patch(
  '/:id',
  authorize(...staffRoles),
  asyncHandler(async (req, res) => {
    const assessment = await Assessment.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!assessment) throw NotFound('Assessment not found');
    return ok(res, assessment);
  }),
);

router.post(
  '/:id/publish',
  authorize('platform_admin', 'platform_owner'),
  asyncHandler(async (req, res) => {
    const assessment = await Assessment.findById(req.params.id);
    if (!assessment) throw NotFound('Assessment not found');
    const approved = await Question.countDocuments({ _id: { $in: assessment.questions }, status: 'approved' });
    if (approved === 0) throw BadRequest('At least one approved question is required before publishing');
    assessment.status = 'published';
    await assessment.save();
    await audit({ req, action: 'assessment.publish', entityType: 'Assessment', entityId: String(assessment._id) });
    return ok(res, assessment);
  }),
);

// -------- Questions --------

router.get(
  '/questions/bank',
  authorize(...staffRoles),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter: Record<string, unknown> = {};
    if (req.query.course) filter.course = req.query.course;
    if (req.query.module) filter.module = req.query.module;
    if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([
      Question.find(filter).select('+correctOptionId').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Question.countDocuments(filter),
    ]);
    return paginated(res, items, { page, limit, total });
  }),
);

router.post(
  '/questions',
  authorize(...staffRoles),
  validate(
    z.object({
      courseId: z.string(),
      moduleId: z.string().optional(),
      questionText: z.string().min(5),
      options: z.array(z.object({ id: z.string(), text: z.string().min(1) })).min(2),
      correctOptionId: z.string(),
      explanation: z.string().optional(),
      difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
      marks: z.number().min(1).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const optionIds = req.body.options.map((o: { id: string }) => o.id);
    if (!optionIds.includes(req.body.correctOptionId)) throw BadRequest('correctOptionId must match one of the options');
    const question = await Question.create({
      course: req.body.courseId,
      module: req.body.moduleId,
      questionText: req.body.questionText,
      options: req.body.options,
      correctOptionId: req.body.correctOptionId,
      explanation: req.body.explanation || '',
      difficulty: req.body.difficulty || 'medium',
      marks: req.body.marks || 1,
      status: req.auth!.role === 'platform_admin' || req.auth!.role === 'platform_owner' ? 'approved' : 'draft',
      createdBy: req.auth!.id,
      approvedBy: isPlatformAdmin(req.auth!.role) ? req.auth!.id : undefined,
    });
    return created(res, question);
  }),
);

router.patch(
  '/questions/:id',
  authorize(...staffRoles),
  asyncHandler(async (req, res) => {
    const question = await Question.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!question) throw NotFound('Question not found');
    return ok(res, question);
  }),
);

router.post(
  '/questions/:id/approve',
  authorize('platform_admin', 'platform_owner'),
  asyncHandler(async (req, res) => {
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'approved', approvedBy: req.auth!.id } },
      { new: true },
    );
    if (!question) throw NotFound('Question not found');
    await audit({ req, action: 'question.approve', entityType: 'Question', entityId: String(question._id) });
    return ok(res, question);
  }),
);

export default router;
