import { Assessment, AssessmentAttempt, Enrollment, Question } from '../models';
import { BadRequest, Forbidden, NotFound } from '../lib/errors';
import { applyAssessmentResult } from './progress.service';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface QuestionLike {
  _id: unknown;
  questionText: string;
  options: { id: string; text: string }[];
  marks: number;
  difficulty?: string;
  sourceRef?: unknown;
}

/** Student-safe question shape: never contains the correct option. */
function toPublicQuestion(doc: QuestionLike, randomizeOptions: boolean) {
  const options = randomizeOptions ? shuffle(doc.options) : doc.options;
  return {
    id: String(doc._id),
    questionText: doc.questionText,
    options: options.map((o) => ({ id: o.id, text: o.text })),
    marks: doc.marks,
  };
}

export async function getAssessmentForStudent(assessmentId: string, studentId: string) {
  const assessment = await Assessment.findById(assessmentId).lean();
  if (!assessment || assessment.status !== 'published') throw NotFound('Assessment not available');
  const enrollment = await Enrollment.findOne({
    student: studentId,
    course: assessment.course,
    status: { $in: ['active', 'completed'] },
  });
  if (!enrollment) throw Forbidden('You are not enrolled in this course');

  const attemptsUsed = await AssessmentAttempt.countDocuments({
    assessment: assessmentId,
    student: studentId,
    status: { $in: ['graded', 'submitted'] },
  });

  return {
    id: String(assessment._id),
    title: assessment.title,
    instructions: assessment.instructions,
    moduleId: assessment.module ? String(assessment.module) : null,
    passMarkPercent: assessment.passMarkPercent,
    timeLimitMinutes: assessment.timeLimitMinutes ?? null,
    attemptsAllowed: assessment.attemptsAllowed,
    attemptsUsed,
    attemptsRemaining: Math.max(0, assessment.attemptsAllowed - attemptsUsed),
    questionCount: assessment.questions.length,
    offlineAllowed: assessment.offlineAllowed,
    enrollmentId: String(enrollment._id),
  };
}

export async function startAttempt(assessmentId: string, studentId: string, clientAttemptId: string) {
  const assessment = await Assessment.findById(assessmentId);
  if (!assessment || assessment.status !== 'published') throw NotFound('Assessment not available');
  const enrollment = await Enrollment.findOne({
    student: studentId,
    course: assessment.course,
    status: { $in: ['active', 'completed'] },
  });
  if (!enrollment) throw Forbidden('You are not enrolled in this course');

  // If the same client attempt id already exists, return it (idempotent retry).
  const existing = await AssessmentAttempt.findOne({ student: studentId, clientAttemptId });
  if (existing) {
    const questions = await Question.find({ _id: { $in: assessment.questions } });
    const ordered = assessment.randomizeQuestions ? shuffle(questions) : questions;
    return {
      attemptId: String(existing._id),
      assessmentId: String(assessment._id),
      questions: ordered.map((q) => toPublicQuestion(q as unknown as QuestionLike, assessment.randomizeOptions)),
    };
  }

  const attemptsUsed = await AssessmentAttempt.countDocuments({
    assessment: assessmentId,
    student: studentId,
    status: { $in: ['graded', 'submitted'] },
  });
  if (attemptsUsed >= assessment.attemptsAllowed) throw BadRequest('No attempts remaining for this assessment');

  const questions = await Question.find({ _id: { $in: assessment.questions } });
  const attempt = await AssessmentAttempt.create({
    assessment: assessment._id,
    course: assessment.course,
    module: assessment.module,
    student: studentId,
    enrollment: enrollment._id,
    clientAttemptId,
    status: 'in_progress',
    attemptNumber: attemptsUsed + 1,
    startedAt: new Date(),
    maxScore: questions.reduce((s, q) => s + (q.marks || 1), 0),
  });

  const ordered = assessment.randomizeQuestions ? shuffle(questions) : questions;
  return {
    attemptId: String(attempt._id),
    assessmentId: String(assessment._id),
    offlineAllowed: assessment.offlineAllowed,
    timeLimitMinutes: assessment.timeLimitMinutes ?? null,
    questions: ordered.map((q) => toPublicQuestion(q as unknown as QuestionLike, assessment.randomizeOptions)),
  };
}

export interface SubmitAnswer {
  questionId: string;
  selectedOptionId: string;
}

export async function submitAttempt(input: {
  attemptId: string;
  studentId: string;
  answers: SubmitAnswer[];
  clientAttemptId?: string;
}) {
  const attempt = await AssessmentAttempt.findById(input.attemptId);
  if (!attempt) throw NotFound('Attempt not found');
  if (String(attempt.student) !== String(input.studentId)) throw Forbidden('This attempt belongs to another user');
  if (attempt.status === 'graded') {
    return publicResult(attempt);
  }

  const assessment = await Assessment.findById(attempt.assessment);
  if (!assessment) throw NotFound('Assessment not found');

  const questions = await Question.find({ _id: { $in: assessment.questions } }).select('+correctOptionId');

  let score = 0;
  let maxScore = 0;
  const gradedAnswers = questions.map((q) => {
    const provided = input.answers.find((a) => String(a.questionId) === String(q._id));
    const selected = provided?.selectedOptionId ?? '';
    const isCorrect = selected === q.correctOptionId;
    const marks = q.marks || 1;
    maxScore += marks;
    if (isCorrect) score += marks;
    return {
      question: q._id,
      selectedOptionId: selected,
      isCorrect,
      marksAwarded: isCorrect ? marks : 0,
    };
  });

  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const passed = percent >= assessment.passMarkPercent;
  const now = new Date();

  let status: 'graded' | 'expired' = 'graded';
  if (assessment.timeLimitMinutes) {
    const deadline = attempt.startedAt.getTime() + assessment.timeLimitMinutes * 60 * 1000;
    if (now.getTime() > deadline + 30 * 1000) status = 'expired';
  }

  attempt.answers = gradedAnswers;
  attempt.score = score;
  attempt.maxScore = maxScore;
  attempt.percent = percent;
  attempt.passed = passed;
  attempt.status = status;
  attempt.submittedAt = now;
  attempt.durationSeconds = Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000);
  attempt.offlineSynced = Boolean(input.clientAttemptId);
  await attempt.save();

  await applyAssessmentResult(String(attempt.enrollment), attempt.module ? String(attempt.module) : undefined, percent, passed);

  return publicResult(attempt);
}

function publicResult(attempt: InstanceType<typeof AssessmentAttempt>) {
  return {
    attemptId: String(attempt._id),
    score: attempt.score,
    maxScore: attempt.maxScore,
    percent: attempt.percent,
    passed: attempt.passed,
    status: attempt.status,
    submittedAt: attempt.submittedAt,
  };
}

export async function getAttemptResult(attemptId: string, studentId: string) {
  const attempt = await AssessmentAttempt.findById(attemptId).lean();
  if (!attempt) throw NotFound('Attempt not found');
  if (String(attempt.student) !== String(studentId)) throw Forbidden();
  const assessment = await Assessment.findById(attempt.assessment).lean();
  if (!assessment) throw NotFound('Assessment not found');

  const questions = await Question.find({ _id: { $in: assessment.questions } }).select('+correctOptionId').lean();
  const byId = new Map(questions.map((q) => [String(q._id), q]));

  const feedback =
    assessment.showFeedbackAfterSubmission && (attempt.status === 'graded' || attempt.status === 'expired')
      ? attempt.answers.map((a: { question: unknown; selectedOptionId: string; isCorrect: boolean }) => {
          const q = byId.get(String(a.question));
          return {
            questionId: String(a.question),
            questionText: q?.questionText ?? '',
            selectedOptionId: a.selectedOptionId,
            correctOptionId: q?.correctOptionId ?? '',
            isCorrect: a.isCorrect,
            explanation: q?.explanation ?? '',
          };
        })
      : undefined;

  return {
    attempt: publicResult(attempt as unknown as InstanceType<typeof AssessmentAttempt>),
    feedback,
  };
}

/** Staff-only: exposes the answer key for authoring/preview. */
export async function staffPreview(assessmentId: string) {
  const assessment = await Assessment.findById(assessmentId).lean();
  if (!assessment) throw NotFound('Assessment not found');
  const questions = await Question.find({ _id: { $in: assessment.questions } }).select('+correctOptionId').lean();
  return {
    assessment: {
      id: String(assessment._id),
      title: assessment.title,
      instructions: assessment.instructions,
      passMarkPercent: assessment.passMarkPercent,
      attemptsAllowed: assessment.attemptsAllowed,
      timeLimitMinutes: assessment.timeLimitMinutes ?? null,
      randomizeQuestions: assessment.randomizeQuestions,
      randomizeOptions: assessment.randomizeOptions,
    },
    questions: questions.map((q) => ({
      id: String(q._id),
      questionText: q.questionText,
      options: q.options,
      correctOptionId: q.correctOptionId,
      explanation: q.explanation,
      marks: q.marks,
      difficulty: q.difficulty,
      sourceRef: q.sourceRef,
      status: q.status,
    })),
  };
}
