import { Router } from 'express';
import { asyncHandler, ok } from '../lib/http';
import { Forbidden, NotFound } from '../lib/errors';
import { authenticate, isPlatformAdmin } from '../middleware/auth';
import { Lesson, Module, PracticalActivity, Enrollment, Assessment, ProjectSubmission } from '../models';
import { ensureProgress, markLessonRead, markPracticalComplete } from '../services/progress.service';

const router = Router();
router.use(authenticate);

async function activeEnrollment(studentId: string, courseId: unknown) {
  return Enrollment.findOne({ student: studentId, course: courseId, status: { $in: ['active', 'completed'] } });
}

router.get(
  '/lessons/:id',
  asyncHandler(async (req, res) => {
    const lesson = await Lesson.findById(req.params.id).lean();
    if (!lesson) throw NotFound('Lesson not found');
    const staff = isPlatformAdmin(req.auth!.role) || req.auth!.role === 'teacher';
    if (!staff) {
      const enrollment = await activeEnrollment(req.auth!.id, lesson.course);
      if (!enrollment) throw Forbidden('You are not enrolled in this course');
      if (lesson.status !== 'published') throw NotFound('Lesson not found');
    }
    return ok(res, lesson);
  }),
);

router.post(
  '/lessons/:id/read',
  asyncHandler(async (req, res) => {
    const lesson = await Lesson.findById(req.params.id).lean();
    if (!lesson) throw NotFound('Lesson not found');
    const enrollment = await activeEnrollment(req.auth!.id, lesson.course);
    if (!enrollment) throw Forbidden('You are not enrolled in this course');
    const progress = await markLessonRead(String(enrollment._id), String(lesson._id));
    return ok(res, { lessonId: lesson._id, progress });
  }),
);

router.get(
  '/modules/:id',
  asyncHandler(async (req, res) => {
    const moduleDoc = await Module.findById(req.params.id).lean();
    if (!moduleDoc) throw NotFound('Module not found');
    const staff = isPlatformAdmin(req.auth!.role) || req.auth!.role === 'teacher';
    const enrollment = await activeEnrollment(req.auth!.id, moduleDoc.course);
    if (!staff && !enrollment) throw Forbidden('You are not enrolled in this course');
    const lessons = await Lesson.find({ module: moduleDoc._id, ...(staff ? {} : { status: 'published' }) }).sort({ order: 1 }).lean();
    const activities = await PracticalActivity.find({ module: moduleDoc._id, ...(staff ? {} : { status: 'published' }) }).lean();
    const assessment = await Assessment.findOne({ module: moduleDoc._id, ...(staff ? {} : { status: 'published' }) }).lean();
    return ok(res, { module: moduleDoc, lessons, activities, assessment });
  }),
);

router.post(
  '/activities/:id/complete',
  asyncHandler(async (req, res) => {
    const activity = await PracticalActivity.findById(req.params.id).lean();
    if (!activity) throw NotFound('Activity not found');
    const enrollment = await activeEnrollment(req.auth!.id, activity.course);
    if (!enrollment) throw Forbidden('You are not enrolled in this course');
    const progress = await markPracticalComplete(String(enrollment._id), String(activity._id));
    return ok(res, progress);
  }),
);

router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    if (req.auth!.role !== 'student') {
      return ok(res, { role: req.auth!.role });
    }
    const enrollments = await Enrollment.find({ student: req.auth!.id }).populate('course').lean();
    const summaries = [];
    for (const en of enrollments) {
      const progress = await ensureProgress(String(en._id));
      if (!progress.lastActivityAt) continue;
      summaries.push({ enrollmentId: String(en._id), course: en.course, completionPercent: progress.completionPercent });
    }
    const pendingSubmissions = await ProjectSubmission.countDocuments({ student: req.auth!.id, status: 'draft' });
    return ok(res, { enrollments, summaries, pendingSubmissions });
  }),
);

export default router;
