import { Types } from 'mongoose';
import {
  BookProcessingJob,
  Course,
  CourseVersion,
  FinalProject,
  FinalProjectTask,
  Lesson,
  Module,
  PracticalActivity,
  Question,
  SourceBook,
} from '../../models';
import type { CourseLevel } from '../../models/enums';
import { logger } from '../../lib/logger';
import { randomCode, slugify, checksum } from '../../lib/ids';
import { storage } from '../storage';
import { detectMime, extractText, type ExtractionResult } from './extract';
import { analyseBook, type ProposedCourse } from './structure';
import { extractQuestions } from './questions';

export interface BookHints {
  title?: string;
  author?: string;
  edition?: string;
  publisher?: string;
  year?: number;
  level?: CourseLevel;
  category?: string;
  subject?: string;
  moduleCode?: string;
  language?: string;
}

const inFlight = new Set<string>();

export async function createBookRecord(input: {
  originalname: string;
  buffer: Buffer;
  size: number;
  uploadedBy: string;
  hints: BookHints;
}) {
  const mime = detectMime(input.originalname);
  const digest = checksum(input.buffer);
  const storageKey = `books/${digest.slice(0, 12)}-${Date.now()}-${input.originalname.replace(/[^\w.-]+/g, '_')}`;
  await storage().put(storageKey, input.buffer, mime);

  const book = await SourceBook.create({
    title: input.hints.title || input.originalname.replace(/\.[^.]+$/, ''),
    author: input.hints.author,
    edition: input.hints.edition,
    publisher: input.hints.publisher,
    year: input.hints.year,
    level: input.hints.level || 'Other',
    subject: input.hints.subject,
    category: input.hints.category,
    moduleCode: input.hints.moduleCode,
    language: input.hints.language || 'en',
    originalFilename: input.originalname,
    storageKey,
    mimeType: mime,
    sizeBytes: input.size,
    checksum: digest,
    status: 'uploaded',
    rights: { accessLevel: 'enrolled_only', copyrightConfirmed: false },
    uploadedBy: input.uploadedBy,
  });

  const job = await BookProcessingJob.create({
    book: book._id,
    status: 'queued',
    requestedBy: input.uploadedBy,
    steps: [
      { name: 'validate', status: 'pending' },
      { name: 'extract', status: 'pending' },
      { name: 'structure', status: 'pending' },
      { name: 'publish-draft', status: 'pending' },
    ],
  });

  return { book, job };
}

export function enqueueBookProcessing(jobId: string): void {
  if (inFlight.has(jobId)) return;
  inFlight.add(jobId);
  setImmediate(() => {
    processBookJob(jobId)
      .catch((err) => logger.error({ err, jobId }, 'Book processing failed'))
      .finally(() => inFlight.delete(jobId));
  });
}

async function setStep(
  jobId: string,
  stepName: string,
  status: 'active' | 'done' | 'failed',
  message?: string,
  progress?: number,
): Promise<void> {
  await BookProcessingJob.updateOne(
    { _id: jobId, 'steps.name': stepName },
    {
      $set: {
        'steps.$.status': status,
        'steps.$.message': message,
        'steps.$.at': new Date(),
        ...(progress !== undefined ? { progress } : {}),
      },
    },
  );
}

export async function processBookJob(jobId: string): Promise<void> {
  const job = await BookProcessingJob.findById(jobId);
  if (!job) return;
  const book = await SourceBook.findById(job.book);
  if (!book) {
    await BookProcessingJob.updateOne({ _id: jobId }, { $set: { status: 'failed', error: 'Book not found' } });
    return;
  }

  try {
    job.status = 'validating';
    job.startedAt = new Date();
    await job.save();
    await setStep(jobId, 'validate', 'active', undefined, 5);
    const buffer = await storage().get(book.storageKey);
    if (buffer.length > Number(process.env.UPLOAD_MAX_MB || 200) * 1024 * 1024) {
      throw new Error('File exceeds maximum configured size');
    }
    await setStep(jobId, 'validate', 'done', 'File validated', 10);

    job.status = 'extracting';
    await job.save();
    await setStep(jobId, 'extract', 'active', undefined, 20);
    const extraction = await extractText(book.originalFilename, buffer);
    book.pageCount = extraction.pageCount;
    book.usedOcr = extraction.usedOcr;
    book.charCount = extraction.text.length;
    book.status = 'processing';
    await book.save();
    await setStep(jobId, 'extract', 'done', `Extracted ${extraction.text.length} characters`, 50);

    job.status = 'structuring';
    await job.save();
    await setStep(jobId, 'structure', 'active', undefined, 60);
    const proposed = analyseBook(extraction, { title: book.title, author: book.author });
    book.detectedMetadata = {
      guessedTitle: proposed.title,
      guessedAuthor: proposed.author,
      tableOfContents: proposed.modules.map((m) => ({ title: m.title, level: 1, page: m.sourcePage, children: [] })),
      learningObjectives: proposed.modules.flatMap((m) => m.learningObjectives),
      units: proposed.modules.map((m) => ({ title: m.title, page: m.sourcePage, kind: 'module' })),
    };
    await setStep(jobId, 'structure', 'done', `${proposed.modules.length} modules detected`, 75);

    await setStep(jobId, 'publish-draft', 'active', undefined, 80);
    const summary = await materialiseCourse(book, proposed, extraction, String(job.requestedBy));
    await setStep(jobId, 'publish-draft', 'done', 'Draft course created', 95);

    book.status = 'ready';
    await book.save();

    job.status = 'review';
    job.progress = 100;
    job.finishedAt = new Date();
    job.result = {
      modulesCreated: summary.modules,
      lessonsCreated: summary.lessons,
      questionsCreated: summary.questions,
      warnings: [...extraction.warnings, ...proposed.warnings, ...summary.warnings],
    };
    await job.save();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    job.status = 'failed';
    job.error = message;
    job.finishedAt = new Date();
    await job.save();
    book.status = 'failed';
    await book.save();
    throw err;
  }
}

interface MaterialiseSummary {
  modules: number;
  lessons: number;
  questions: number;
  warnings: string[];
  courseId: string;
}

async function materialiseCourse(
  book: InstanceType<typeof SourceBook>,
  proposed: ReturnType<typeof analyseBook>,
  extraction: ExtractionResult,
  userId: string,
): Promise<MaterialiseSummary> {
  const warnings: string[] = [];
  const title = book.title;

  let course = await Course.findOne({ sourceBook: book._id });
  if (!course) {
    course = await Course.create({
      title,
      slug: slugify(title),
      code: book.moduleCode || `CRS-${randomCode(6)}`,
      summary: `A structured course derived from "${book.title}".`,
      level: book.level,
      category: book.category || 'Software Development',
      subject: book.subject || '',
      status: 'draft',
      sourceBook: book._id,
      createdBy: userId,
      tags: [book.level, book.category].filter(Boolean) as string[],
      theoryPercent: 20,
      practicePercent: 80,
    });
  }

  let lessonsCreated = 0;
  const moduleIds: Types.ObjectId[] = [];

  for (const [index, mod] of proposed.modules.entries()) {
    const moduleDoc = await Module.create({
      course: course._id,
      order: index + 1,
      title: mod.title,
      summary: mod.summary || '',
      learningObjectives: mod.learningObjectives,
      estimatedMinutes: 120,
      sourceRef: { page: mod.sourcePage },
      status: 'draft',
    });
    moduleIds.push(moduleDoc._id);

    let lessonOrder = 0;
    for (const lesson of mod.lessons) {
      lessonOrder += 1;
      await Lesson.create({
        course: course._id,
        module: moduleDoc._id,
        order: lessonOrder,
        kind: lesson.kind,
        title: lesson.title,
        content: lesson.blocks,
        sourceRef: { page: lesson.sourcePage },
        contentSourceKind: 'summary',
        status: 'draft',
      });
      lessonsCreated += 1;
    }

    for (const activity of mod.activities) {
      await PracticalActivity.create({
        course: course._id,
        module: moduleDoc._id,
        title: activity.title,
        kind: activity.kind,
        instructions: activity.instructions.trim(),
        steps: activity.steps.map((s) => ({ text: s })),
        sourceRefs: activity.sourcePage ? [{ page: activity.sourcePage }] : [],
        status: 'draft',
      });
    }
  }

  const { questions, warnings: qWarnings } = extractQuestions(extraction);
  warnings.push(...qWarnings);
  let questionCount = 0;
  for (const q of questions) {
    await Question.create({
      course: course._id,
      questionText: q.questionText,
      options: q.options,
      correctOptionId: q.correctOptionId,
      sourceRef: q.sourcePage ? { page: q.sourcePage } : {},
      status: 'draft',
      createdBy: userId,
      contentSourceKind: 'verbatim',
    });
    questionCount += 1;
  }

  await ensureFinalProject(course._id, userId, proposed);

  const version = await CourseVersion.create({
    course: course._id,
    version: (await CourseVersion.countDocuments({ course: course._id })) + 1,
    status: 'draft',
    sourceBook: book._id,
    modules: moduleIds,
    changelog: 'Auto-generated from book ingestion (pending review).',
    createdBy: userId,
  });
  course.activeVersion = version._id;
  await course.save();

  book.course = course._id;
  await book.save();

  if (questionCount === 0) {
    warnings.push('No assessment questions were created. A teacher/admin must author module assessments before publishing.');
  }

  return { modules: proposed.modules.length, lessons: lessonsCreated, questions: questionCount, warnings, courseId: String(course._id) };
}

/**
 * Create the mandatory final project with exactly three tasks. The tasks are
 * grounded in the module titles discovered from the book and are created as
 * DRAFTS that an administrator/teacher must review and finalise. The system does
 * not present fabricated, book-derived project content as authoritative.
 */
async function ensureFinalProject(courseId: Types.ObjectId, userId: string, proposed: ProposedCourse): Promise<void> {
  const existing = await FinalProject.findOne({ course: courseId });
  if (existing) return;

  const moduleTitles = proposed.modules.map((m) => m.title).filter(Boolean);
  const first = moduleTitles.slice(0, Math.max(1, Math.ceil(moduleTitles.length / 3)));
  const middle = moduleTitles.slice(first.length, Math.max(first.length + 1, Math.ceil((moduleTitles.length * 2) / 3)));
  const all = moduleTitles;

  const project = await FinalProject.create({
    course: courseId,
    title: 'Final Project',
    description:
      'A single comprehensive project assessed through three tasks. DRAFT — review and adapt these tasks to the specific competencies of this course before publishing.',
    status: 'draft',
    createdBy: userId,
  });

  const tasks = [
    {
      order: 1 as const,
      kind: 'foundational' as const,
      title: 'Task 1 — Foundational application',
      instructions:
        'Demonstrate the fundamental concepts from the early part of the course by producing a small, complete artefact. Work individually and document each step.',
      deliverables: ['A working artefact covering the foundational concepts', 'A short written justification of your approach'],
      acceptanceCriteria: [
        'Correctly applies the core concepts',
        'Meets the stated functional requirements',
        'Includes evidence (screenshots/code/working result)',
      ],
      refs: first,
    },
    {
      order: 2 as const,
      kind: 'integrated' as const,
      title: 'Task 2 — Integrated practical implementation',
      instructions:
        'Combine concepts from multiple modules to solve a meaningful, subject-specific problem. Integrate at least two distinct areas of the course.',
      deliverables: ['An integrated solution', 'A brief design/approach explanation', 'Test or validation evidence'],
      acceptanceCriteria: [
        'Integrates multiple modules coherently',
        'Solves a realistic problem',
        'Is tested or validated',
      ],
      refs: middle,
    },
    {
      order: 3 as const,
      kind: 'capstone' as const,
      title: 'Task 3 — Independent capstone challenge',
      instructions:
        'Independently design and build a coherent capstone deliverable that demonstrates overall course competence across the major learning outcomes.',
      deliverables: ['A complete capstone deliverable', 'Documentation', 'A reflective summary of decisions and limitations'],
      acceptanceCriteria: [
        'Demonstrates overall course competence',
        'Is coherent and well documented',
        'Reflects on decisions, trade-offs and limitations',
      ],
      refs: all,
    },
  ];

  const createdTasks = [];
  for (const t of tasks) {
    createdTasks.push(
      await FinalProjectTask.create({
        project: project._id,
        course: courseId,
        order: t.order,
        kind: t.kind,
        title: t.title,
        instructions: t.instructions,
        deliverables: t.deliverables,
        acceptanceCriteria: t.acceptanceCriteria,
        marks: 100,
        rubric: [
          { criterion: 'Correctness / completeness', marks: 50 },
          { criterion: 'Quality and clarity', marks: 30 },
          { criterion: 'Documentation and evidence', marks: 20 },
        ],
      }),
    );
  }

  project.tasks = createdTasks.map((t) => t._id);
  project.taskCount = createdTasks.length;
  await project.save();
}

