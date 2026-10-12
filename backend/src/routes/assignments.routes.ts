import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { asyncHandler, created, ok, paginated, parsePagination } from '../lib/http';
import { BadRequest, Forbidden, NotFound } from '../lib/errors';
import { authenticate, authorize, isPlatformAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { audit } from '../lib/audit';
import { Assignment, AssignmentSubmission, ClassGroup, Course, Enrollment } from '../models';

const router = Router();
router.use(authenticate);

const staffRoles = ['platform_admin', 'platform_owner', 'teacher'] as const;

async function isAssignedTeacher(userId: string, role: string, courseId: string, classGroups: string[]) {
  if (isPlatformAdmin(role)) return true;
  const kls = await ClassGroup.find({ _id: { $in: classGroups }, teachers: userId }).lean();
  if (kls.length) return true;
  const anyClass = await ClassGroup.find({ courses: courseId, teachers: userId }).lean();
  return anyClass.length > 0;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    if (req.auth!.role === 'student') {
      const enrollments = await Enrollment.find({ student: req.auth!.id, status: { $in: ['active', 'completed'] } }).lean();
      const courseIds = enrollments.map((e) => e.course);
      const classIds = enrollments.map((e) => e.classGroup).filter(Boolean);
      const filter: Record<string, unknown> = {
        status: 'published',
        course: { $in: courseIds },
      };
      if (classIds.length) filter.classGroups = { $in: classIds };
      const items = await Assignment.find(filter).sort({ dueAt: 1 }).skip(skip).limit(limit).lean();
      const submissions = await AssignmentSubmission.find({
        assignment: { $in: items.map((a) => a._id) },
        student: req.auth!.id,
      }).lean();
      const byAssignment = new Map(submissions.map((s) => [String(s.assignment), s]));
      const merged = items.map((a) => ({ ...a, mySubmission: byAssignment.get(String(a._id)) || null }));
      return ok(res, merged);
    }

    const items = await Assignment.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    return paginated(res, items, { page, limit, total: items.length });
  }),
);

router.post(
  '/',
  authorize(...staffRoles),
  validate(
    z.object({
      courseId: z.string(),
      moduleId: z.string().optional(),
      classGroups: z.array(z.string()).optional(),
      title: z.string().min(3),
      instructions: z.string().optional(),
      deliverables: z.array(z.string()).optional(),
      startAt: z.coerce.date().optional(),
      dueAt: z.coerce.date().optional(),
      allowLate: z.boolean().optional(),
      latePenaltyPercent: z.number().min(0).max(100).optional(),
      marks: z.number().min(1).optional(),
      rubric: z.array(z.object({ criterion: z.string(), marks: z.number(), description: z.string().optional() })).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const course = await Course.findById(req.body.courseId).lean();
    if (!course) throw NotFound('Course not found');
    const allowed = await isAssignedTeacher(req.auth!.id, req.auth!.role, String(course._id), req.body.classGroups || []);
    if (!allowed) throw Forbidden('You are not assigned to this course');
    const assignment = await Assignment.create({
      ...req.body,
      status: 'draft',
      createdBy: req.auth!.id,
    });
    await audit({ req, action: 'assignment.create', entityType: 'Assignment', entityId: String(assignment._id) });
    return created(res, assignment);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id).lean();
    if (!assignment) throw NotFound('Assignment not found');
    if (req.auth!.role === 'student') {
      if (assignment.status !== 'published') throw NotFound('Assignment not found');
      const submission = await AssignmentSubmission.findOne({ assignment: assignment._id, student: req.auth!.id }).lean();
      return ok(res, { assignment, mySubmission: submission });
    }
    return ok(res, assignment);
  }),
);

router.patch(
  '/:id',
  authorize(...staffRoles),
  asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) throw NotFound('Assignment not found');
    const allowed = await isAssignedTeacher(req.auth!.id, req.auth!.role, String(assignment.course), assignment.classGroups.map(String));
    if (!allowed) throw Forbidden('You are not assigned to this course');
    if (req.body.dueAt && String(req.body.dueAt) !== String(assignment.dueAt)) {
      assignment.deadlineHistory.push({ changedAt: new Date(), changedBy: new Types.ObjectId(req.auth!.id), from: assignment.dueAt, to: new Date(req.body.dueAt) });
    }
    Object.assign(assignment, req.body);
    await assignment.save();
    await audit({ req, action: 'assignment.update', entityType: 'Assignment', entityId: String(assignment._id) });
    return ok(res, assignment);
  }),
);

router.post(
  '/:id/publish',
  authorize(...staffRoles),
  asyncHandler(async (req, res) => {
    const assignment = await Assignment.findByIdAndUpdate(req.params.id, { $set: { status: 'published' } }, { new: true });
    if (!assignment) throw NotFound('Assignment not found');
    return ok(res, assignment);
  }),
);

router.get(
  '/:id/preview',
  authorize(...staffRoles),
  asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id).lean();
    if (!assignment) throw NotFound('Assignment not found');
    return ok(res, { preview: true, assignment });
  }),
);

router.post(
  '/:id/submissions',
  validate(
    z.object({
      clientSubmissionId: z.string().min(6),
      content: z.string().optional(),
      files: z.array(z.object({ key: z.string(), name: z.string(), size: z.number(), mimeType: z.string() })).optional(),
      submit: z.boolean().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id).lean();
    if (!assignment || assignment.status !== 'published') throw NotFound('Assignment not available');
    const enrollment = await Enrollment.findOne({ student: req.auth!.id, course: assignment.course, status: { $in: ['active', 'completed'] } });
    if (!enrollment) throw Forbidden('You are not enrolled in this course');

    const isLate = Boolean(assignment.dueAt && new Date() > assignment.dueAt);
    if (isLate && !assignment.allowLate) throw BadRequest('The deadline has passed and late submissions are not allowed');

    let submission = await AssignmentSubmission.findOne({ assignment: assignment._id, student: req.auth!.id });
    if (!submission) {
      submission = new AssignmentSubmission({
        assignment: assignment._id,
        course: assignment.course,
        student: req.auth!.id,
        enrollment: enrollment._id,
        clientSubmissionId: req.body.clientSubmissionId,
      });
    }
    submission.content = req.body.content ?? submission.content;
    if (req.body.files) submission.files = req.body.files;
    if (req.body.submit) {
      submission.status = isLate ? 'late' : 'submitted';
      submission.isLate = isLate;
      submission.submittedAt = new Date();
    }
    await submission.save();
    await audit({ req, action: 'assignment.submit', entityType: 'AssignmentSubmission', entityId: String(submission._id) });
    return created(res, submission);
  }),
);

router.get(
  '/:id/submissions',
  authorize(...staffRoles),
  asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id).lean();
    if (!assignment) throw NotFound('Assignment not found');
    const submissions = await AssignmentSubmission.find({ assignment: assignment._id })
      .populate('student', 'name email')
      .sort({ submittedAt: -1 })
      .lean();
    return ok(res, submissions);
  }),
);

router.post(
  '/submissions/:id/grade',
  authorize(...staffRoles),
  validate(
    z.object({
      grade: z.number().min(0),
      feedback: z.string().optional(),
      rubricScores: z.array(z.object({ criterion: z.string(), marks: z.number() })).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const submission = await AssignmentSubmission.findById(req.params.id);
    if (!submission) throw NotFound('Submission not found');
    submission.grade = req.body.grade;
    submission.feedback = req.body.feedback;
    if (req.body.rubricScores) submission.rubricScores = req.body.rubricScores;
    submission.status = 'graded';
    submission.gradedBy = new Types.ObjectId(req.auth!.id);
    submission.gradedAt = new Date();
    await submission.save();
    await audit({ req, action: 'assignment.grade', entityType: 'AssignmentSubmission', entityId: String(submission._id) });
    return ok(res, submission);
  }),
);

export default router;
