import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { asyncHandler, created, ok } from '../lib/http';
import { BadRequest, Forbidden, NotFound } from '../lib/errors';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { audit } from '../lib/audit';
import { Course, Enrollment, FinalProject, FinalProjectTask, ProjectSubmission } from '../models';

const router = Router();
router.use(authenticate);

const staffRoles = ['platform_admin', 'platform_owner', 'teacher'] as const;

router.get(
  '/course/:courseId',
  asyncHandler(async (req, res) => {
    const project = await FinalProject.findOne({ course: req.params.courseId }).lean();
    if (!project) throw NotFound('No final project for this course');
    const tasks = await FinalProjectTask.find({ project: project._id }).sort({ order: 1 }).lean();
    if (req.auth!.role === 'student' && project.status !== 'published') throw NotFound('Final project not available');
    if (req.auth!.role === 'student') {
      const enrollment = await Enrollment.findOne({ student: req.auth!.id, course: req.params.courseId });
      if (!enrollment) throw Forbidden('You are not enrolled in this course');
      const submissions = await import('../models').then(({ ProjectSubmission }) =>
        ProjectSubmission.find({ student: req.auth!.id, task: { $in: tasks.map((t) => t._id) } }).lean(),
      );
      const byTask = new Map(submissions.map((s) => [String(s.task), s]));
      return ok(res, { project, tasks: tasks.map((t) => ({ ...t, mySubmission: byTask.get(String(t._id)) || null })) });
    }
    return ok(res, { project, tasks });
  }),
);

router.post(
  '/:projectId/publish',
  authorize('platform_admin', 'platform_owner'),
  asyncHandler(async (req, res) => {
    const project = await FinalProject.findById(req.params.projectId);
    if (!project) throw NotFound('Project not found');
    const taskCount = await FinalProjectTask.countDocuments({ project: project._id });
    if (taskCount !== 3) throw BadRequest('A final project must have exactly three tasks before publishing');
    project.status = 'published';
    project.taskCount = 3;
    await project.save();
    await audit({ req, action: 'project.publish', entityType: 'FinalProject', entityId: String(project._id) });
    return ok(res, project);
  }),
);

router.post(
  '/course/:courseId/tasks',
  authorize('platform_admin', 'platform_owner'),
  validate(
    z.object({
      tasks: z
        .array(
          z.object({
            order: z.number().min(1).max(3),
            kind: z.enum(['foundational', 'integrated', 'capstone']),
            title: z.string().min(3),
            instructions: z.string().optional(),
            deliverables: z.array(z.string()).optional(),
            acceptanceCriteria: z.array(z.string()).optional(),
            marks: z.number().min(1).optional(),
            deadline: z.coerce.date().optional(),
          }),
        )
        .length(3),
    }),
  ),
  asyncHandler(async (req, res) => {
    const course = await Course.findById(req.params.courseId);
    if (!course) throw NotFound('Course not found');
    let project = await FinalProject.findOne({ course: course._id });
    if (!project) {
      project = await FinalProject.create({ course: course._id, createdBy: req.auth!.id, status: 'draft' });
    }
    await FinalProjectTask.deleteMany({ project: project._id });
    const tasks = await FinalProjectTask.insertMany(
      req.body.tasks.map((t: Record<string, unknown>) => ({ ...t, project: project!._id, course: course._id })),
    );
    project.tasks = tasks.map((t) => t._id);
    project.taskCount = tasks.length;
    await project.save();
    await audit({ req, action: 'project.tasks.set', entityType: 'FinalProject', entityId: String(project._id) });
    return ok(res, { project, tasks });
  }),
);

router.post(
  '/tasks/:taskId/submissions',
  validate(
    z.object({
      clientSubmissionId: z.string().min(6),
      content: z.string().optional(),
      files: z.array(z.object({ key: z.string(), name: z.string(), size: z.number(), mimeType: z.string() })).optional(),
      submit: z.boolean().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const task = await FinalProjectTask.findById(req.params.taskId).lean();
    if (!task) throw NotFound('Task not found');
    const enrollment = await Enrollment.findOne({ student: req.auth!.id, course: task.course, status: { $in: ['active', 'completed'] } });
    if (!enrollment) throw Forbidden('You are not enrolled in this course');

    const isLate = Boolean(task.deadline && new Date() > task.deadline);
    let submission = await ProjectSubmission.findOne({ task: task._id, student: req.auth!.id });
    if (!submission) {
      submission = new ProjectSubmission({
        task: task._id,
        project: task.project,
        course: task.course,
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
    await (await import('../services/progress.service')).recomputeProjectCompletion(String(enrollment._id));
    return created(res, submission);
  }),
);

router.get(
  '/tasks/:taskId/submissions',
  authorize(...staffRoles),
  asyncHandler(async (req, res) => {
    const submissions = await ProjectSubmission.find({ task: req.params.taskId })
      .populate('student', 'name email')
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
    const submission = await ProjectSubmission.findById(req.params.id);
    if (!submission) throw NotFound('Submission not found');
    submission.grade = req.body.grade;
    submission.feedback = req.body.feedback;
    if (req.body.rubricScores) submission.rubricScores = req.body.rubricScores;
    submission.status = 'graded';
    submission.gradedBy = new Types.ObjectId(req.auth!.id);
    submission.gradedAt = new Date();
    await submission.save();
    const { recomputeProjectCompletion } = await import('../services/progress.service');
    await recomputeProjectCompletion(String(submission.enrollment));
    await audit({ req, action: 'project.grade', entityType: 'ProjectSubmission', entityId: String(submission._id) });
    return ok(res, submission);
  }),
);

router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const submissions = await ProjectSubmission.find({ student: req.auth!.id }).populate('task').lean();
    return ok(res, submissions);
  }),
);

export default router;
