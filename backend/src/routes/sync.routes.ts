import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../lib/http';
import { Forbidden, NotFound } from '../lib/errors';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  Assignment,
  AssignmentSubmission,
  Enrollment,
  FinalProjectTask,
  OfflineSyncEvent,
  ProjectSubmission,
} from '../models';
import { startAttempt, submitAttempt } from '../services/assessment.service';
import { markLessonRead, markPracticalComplete } from '../services/progress.service';

const router = Router();
router.use(authenticate);

async function applyEvent(studentId: string, type: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  switch (type) {
    case 'progress': {
      const enrollmentId = String(payload.enrollmentId || '');
      const owned = await Enrollment.findOne({ _id: enrollmentId, student: studentId });
      if (!owned) throw Forbidden('You cannot update progress for this enrollment');
      if (payload.lessonId) await markLessonRead(enrollmentId, String(payload.lessonId));
      if (payload.activityId) await markPracticalComplete(enrollmentId, String(payload.activityId));
      return { applied: true, lessonId: payload.lessonId ?? null, activityId: payload.activityId ?? null };
    }
    case 'assessment_attempt': {
      const assessmentId = String(payload.assessmentId || '');
      const clientAttemptId = String(payload.clientAttemptId || '');
      if (!assessmentId || !clientAttemptId) throw Forbidden('assessmentId and clientAttemptId are required');
      const started = await startAttempt(assessmentId, studentId, clientAttemptId);
      const answers = Array.isArray(payload.answers) ? (payload.answers as { questionId: string; selectedOptionId: string }[]) : [];
      const result = await submitAttempt({
        attemptId: started.attemptId,
        studentId,
        answers,
        clientAttemptId,
      });
      return result as unknown as Record<string, unknown>;
    }
    case 'assignment_submission': {
      const assignmentId = String(payload.assignmentId || '');
      const assignment = await Assignment.findById(assignmentId).lean();
      if (!assignment || assignment.status !== 'published') throw NotFound('Assignment not available');
      const enrollment = await Enrollment.findOne({ student: studentId, course: assignment.course, status: { $in: ['active', 'completed'] } });
      if (!enrollment) throw Forbidden('You are not enrolled in this course');
      const submission = await upsertSubmission(
        'assignment',
        assignmentId,
        assignment.course,
        enrollment._id,
        studentId,
        payload,
      );
      return { submissionId: String(submission._id) };
    }
    case 'project_submission': {
      const taskId = String(payload.taskId || '');
      const task = await FinalProjectTask.findById(taskId).lean();
      if (!task) throw NotFound('Task not found');
      const enrollment = await Enrollment.findOne({ student: studentId, course: task.course, status: { $in: ['active', 'completed'] } });
      if (!enrollment) throw Forbidden('You are not enrolled in this course');
      const submission = await upsertSubmission('project', taskId, task.course, enrollment._id, studentId, payload);
      const { recomputeProjectCompletion } = await import('../services/progress.service');
      await recomputeProjectCompletion(String(enrollment._id));
      return { submissionId: String(submission._id) };
    }
    default:
      throw NotFound('Unsupported sync entity type');
  }
}

async function upsertSubmission(
  kind: 'assignment' | 'project',
  targetId: string,
  courseId: unknown,
  enrollmentId: unknown,
  studentId: string,
  payload: Record<string, unknown>,
) {
  const files = Array.isArray(payload.files) ? (payload.files as { key: string; name: string; size: number; mimeType: string }[]) : undefined;
  const clientId = String(payload.clientSubmissionId || payload.clientId || '');

  if (kind === 'assignment') {
    let sub = await AssignmentSubmission.findOne({ assignment: targetId, student: studentId });
    if (!sub) {
      sub = new AssignmentSubmission({
        assignment: targetId,
        course: courseId,
        enrollment: enrollmentId,
        student: studentId,
        clientSubmissionId: clientId,
      });
    }
    if (payload.content !== undefined) sub.content = String(payload.content);
    if (files) sub.files = files;
    sub.status = 'submitted';
    sub.submittedAt = new Date();
    await sub.save();
    return sub;
  }

  let sub = await ProjectSubmission.findOne({ task: targetId, student: studentId });
  if (!sub) {
    const task = await FinalProjectTask.findById(targetId).lean();
    sub = new ProjectSubmission({
      task: targetId,
      project: task?.project,
      course: courseId,
      enrollment: enrollmentId,
      student: studentId,
      clientSubmissionId: clientId,
    });
  }
  if (payload.content !== undefined) sub.content = String(payload.content);
  if (files) sub.files = files;
  sub.status = 'submitted';
  sub.submittedAt = new Date();
  await sub.save();
  return sub;
}

router.post(
  '/batch',
  validate(
    z.object({
      events: z
        .array(
          z.object({
            entityType: z.enum(['progress', 'assessment_attempt', 'project_submission', 'assignment_submission']),
            clientId: z.string().optional(),
            idempotencyKey: z.string().min(6),
            payload: z.record(z.unknown()),
          }),
        )
        .max(200),
    }),
  ),
  asyncHandler(async (req, res) => {
    const results: { idempotencyKey: string; status: string; result?: unknown; error?: string }[] = [];
    for (const ev of req.body.events) {
      const prior = await OfflineSyncEvent.findOne({ user: req.auth!.id, idempotencyKey: ev.idempotencyKey });
      if (prior && prior.processed) {
        results.push({ idempotencyKey: ev.idempotencyKey, status: 'duplicate', result: prior.result });
        continue;
      }
      try {
        const result = await applyEvent(req.auth!.id, ev.entityType, ev.payload);
        await OfflineSyncEvent.create({
          user: req.auth!.id,
          entityType: ev.entityType,
          clientId: ev.clientId || ev.idempotencyKey,
          idempotencyKey: ev.idempotencyKey,
          processed: true,
          result,
        });
        results.push({ idempotencyKey: ev.idempotencyKey, status: 'applied', result });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sync failed';
        await OfflineSyncEvent.updateOne(
          { user: req.auth!.id, idempotencyKey: ev.idempotencyKey },
          {
            $setOnInsert: {
              entityType: ev.entityType,
              clientId: ev.clientId || ev.idempotencyKey,
            },
            $set: { processed: false, error: message, conflict: true },
          },
          { upsert: true },
        );
        results.push({ idempotencyKey: ev.idempotencyKey, status: 'failed', error: message });
      }
    }
    return ok(res, { received: req.body.events.length, results });
  }),
);

router.get(
  '/events',
  asyncHandler(async (req, res) => {
    const events = await OfflineSyncEvent.find({ user: req.auth!.id }).sort({ createdAt: -1 }).limit(100).lean();
    return ok(res, events);
  }),
);

export default router;
