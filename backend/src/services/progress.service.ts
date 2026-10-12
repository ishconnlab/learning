import {
  Assessment,
  AssessmentAttempt,
  Course,
  Enrollment,
  FinalProject,
  Lesson,
  Module,
  PracticalActivity,
  ProjectSubmission,
  StudentProgress,
} from '../models';
import { NotFound } from '../lib/errors';

export async function ensureProgress(enrollmentId: string) {
  const enrollment = await Enrollment.findById(enrollmentId);
  if (!enrollment) throw NotFound('Enrollment not found');

  let progress = await StudentProgress.findOne({ enrollment: enrollmentId });
  if (!progress) {
    const modules = await Module.find({ course: enrollment.course }).sort({ order: 1 }).lean();
    const lessons = await Lesson.find({ course: enrollment.course }).select('module').lean();
    const activities = await PracticalActivity.find({ course: enrollment.course }).select('module').lean();

    progress = await StudentProgress.create({
      enrollment: enrollment._id,
      student: enrollment.student,
      course: enrollment.course,
      modules: modules.map((m) => ({
        module: m._id,
        started: false,
        completed: false,
        lessonsRead: [],
        lessonsTotal: lessons.filter((l) => String(l.module) === String(m._id)).length,
        practicalCompleted: [],
        practicalTotal: activities.filter((a) => String(a.module) === String(m._id)).length,
        assessmentPassed: false,
        assessmentBestPercent: 0,
        updatedAt: new Date(),
      })),
    });
  }
  return progress;
}

export async function markLessonRead(enrollmentId: string, lessonId: string) {
  const progress = await ensureProgress(enrollmentId);
  const lesson = await Lesson.findById(lessonId).lean();
  if (!lesson || String(lesson.course) !== String(progress.course)) throw NotFound('Lesson not in this course');

  const entry = progress.modules.find((m) => String(m.module) === String(lesson.module));
  if (entry && !entry.lessonsRead.some((id) => String(id) === lessonId)) {
    entry.lessonsRead.push(lesson._id);
    entry.started = true;
    entry.updatedAt = new Date();
  }
  progress.lastActivityAt = new Date();
  return recompute(progress);
}

export async function markPracticalComplete(enrollmentId: string, activityId: string) {
  const progress = await ensureProgress(enrollmentId);
  const activity = await PracticalActivity.findById(activityId).lean();
  if (!activity || String(activity.course) !== String(progress.course)) throw NotFound('Activity not in this course');

  const entry = progress.modules.find((m) => String(m.module) === String(activity.module));
  if (entry && !entry.practicalCompleted.some((id) => String(id) === activityId)) {
    entry.practicalCompleted.push(activity._id);
    entry.started = true;
    entry.updatedAt = new Date();
    progress.timeSpentSeconds += (activity.estimatedMinutes || 0) * 60;
  }
  progress.lastActivityAt = new Date();
  return recompute(progress);
}

export async function applyAssessmentResult(enrollmentId: string, moduleId: string | undefined, percent: number, passed: boolean) {
  const progress = await ensureProgress(enrollmentId);
  if (moduleId) {
    const entry = progress.modules.find((m) => String(m.module) === String(moduleId));
    if (entry) {
      entry.assessmentBestPercent = Math.max(entry.assessmentBestPercent, percent);
      entry.assessmentPassed = entry.assessmentPassed || passed;
      entry.started = true;
      entry.updatedAt = new Date();
    }
  }
  progress.lastActivityAt = new Date();
  return recompute(progress);
}

export async function recomputeProjectCompletion(enrollmentId: string): Promise<void> {
  await ensureProgress(enrollmentId);
  const progress = await StudentProgress.findOne({ enrollment: enrollmentId });
  if (!progress) return;
  await recompute(progress);
}

async function recompute(progress: InstanceType<typeof StudentProgress>) {
  const course = await Course.findById(progress.course).lean();
  const totalModules = progress.modules.length || 0;

  // Ensure assessment pass state reflects the best graded attempt when available.
  const moduleAssessments = await Assessment.find({ course: progress.course }).select('module').lean();
  for (const assessment of moduleAssessments) {
    if (!assessment.module) continue;
    const entry = progress.modules.find((m) => String(m.module) === String(assessment.module));
    if (!entry) continue;
    const best = await AssessmentAttempt.findOne({
      enrollment: progress.enrollment,
      assessment: assessment._id,
      status: 'graded',
    })
      .sort({ percent: -1 })
      .lean();
    if (best) {
      entry.assessmentBestPercent = Math.max(entry.assessmentBestPercent, best.percent);
      entry.assessmentPassed = entry.assessmentPassed || best.passed;
    }
  }

  let completedModules = 0;
  let totalLessons = 0;
  let readLessons = 0;
  let totalPractical = 0;
  let donePractical = 0;

  for (const m of progress.modules) {
    totalLessons += m.lessonsTotal;
    readLessons += m.lessonsRead.length;
    totalPractical += m.practicalTotal;
    donePractical += m.practicalCompleted.length;

    const lessonsOk = m.lessonsTotal === 0 || m.lessonsRead.length >= m.lessonsTotal;
    const practicalOk = m.practicalTotal === 0 || m.practicalCompleted.length >= m.practicalTotal;
    const assessmentOk = !moduleAssessments.some((a) => String(a.module) === String(m.module)) || m.assessmentPassed;
    m.completed = Boolean(lessonsOk && practicalOk && assessmentOk);
    if (m.completed) completedModules += 1;
  }

  // Final project: require all three tasks to have a submitted/graded submission.
  const project = await FinalProject.findOne({ course: progress.course }).lean();
  let tasksCompleted = 0;
  let projectComplete = true;
  if (project && project.tasks.length) {
    const submissions = await ProjectSubmission.find({
      enrollment: progress.enrollment,
      task: { $in: project.tasks },
      status: { $in: ['submitted', 'graded', 'returned', 'resubmitted'] },
    }).lean();
    tasksCompleted = new Set(submissions.map((s) => String(s.task))).size;
    projectComplete = tasksCompleted >= project.tasks.length;
  }
  progress.finalProjectTasksCompleted = tasksCompleted;

  progress.completionPercent = totalModules ? Math.round((completedModules / totalModules) * 100) : 0;
  progress.theoryCompletedPercent = totalLessons ? Math.round((readLessons / totalLessons) * 100) : 0;
  progress.practiceCompletedPercent = totalPractical ? Math.round((donePractical / totalPractical) * 100) : 0;

  const modulesComplete = totalModules > 0 && completedModules === totalModules;
  progress.certificateEligible = Boolean(
    modulesComplete && projectComplete && course?.certificateEligible !== false && progress.student,
  );

  await progress.save();
  return progress;
}

export async function getProgressForEnrollment(enrollmentId: string) {
  return ensureProgress(enrollmentId).then((p) => recompute(p));
}
