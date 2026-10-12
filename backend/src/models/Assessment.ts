import { Schema, Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './base';
import { ATTEMPT_STATUS, AttemptStatus, CONTENT_SOURCE_KIND, ContentSourceKind, DIFFICULTY, Difficulty } from './enums';
import { ISourceRef, sourceRefSchema } from './Content';

export interface IQuestionOption {
  id: string;
  text: string;
}

export interface IQuestion {
  _id: Types.ObjectId;
  course: Types.ObjectId;
  module?: Types.ObjectId;
  questionText: string;
  options: IQuestionOption[];
  /** Never exposed through public/student APIs before grading. */
  correctOptionId: string;
  explanation: string;
  sourceRef: ISourceRef;
  difficulty: Difficulty;
  marks: number;
  contentSourceKind: ContentSourceKind;
  status: 'draft' | 'approved' | 'rejected';
  createdBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<IQuestion>(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    module: { type: Schema.Types.ObjectId, ref: 'Module', index: true },
    questionText: { type: String, required: true },
    options: [
      new Schema({ id: { type: String, required: true }, text: { type: String, required: true } }, { _id: false }),
    ],
    correctOptionId: { type: String, required: true, select: false },
    explanation: { type: String, default: '' },
    sourceRef: { type: sourceRefSchema, default: {} },
    difficulty: { type: String, enum: DIFFICULTY, default: 'medium' },
    marks: { type: Number, default: 1, min: 1 },
    contentSourceKind: { type: String, enum: CONTENT_SOURCE_KIND, default: 'derived_practice' },
    status: { type: String, enum: ['draft', 'approved', 'rejected'], default: 'draft', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions,
);

questionSchema.index({ course: 1, module: 1, status: 1 });

export const Question = defineModel<IQuestion>('Question', questionSchema);

export interface IAssessment {
  _id: Types.ObjectId;
  course: Types.ObjectId;
  module?: Types.ObjectId;
  title: string;
  instructions: string;
  questions: Types.ObjectId[];
  passMarkPercent: number;
  attemptsAllowed: number;
  timeLimitMinutes?: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  showFeedbackAfterSubmission: boolean;
  offlineAllowed: boolean;
  status: 'draft' | 'published' | 'archived';
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const assessmentSchema = new Schema<IAssessment>(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    module: { type: Schema.Types.ObjectId, ref: 'Module', index: true },
    title: { type: String, required: true },
    instructions: { type: String, default: '' },
    questions: [{ type: Schema.Types.ObjectId, ref: 'Question', index: true }],
    passMarkPercent: { type: Number, default: 60, min: 0, max: 100 },
    attemptsAllowed: { type: Number, default: 3, min: 1 },
    timeLimitMinutes: { type: Number },
    randomizeQuestions: { type: Boolean, default: true },
    randomizeOptions: { type: Boolean, default: true },
    showFeedbackAfterSubmission: { type: Boolean, default: true },
    offlineAllowed: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  baseSchemaOptions,
);

export const Assessment = defineModel<IAssessment>('Assessment', assessmentSchema);

export interface IAttemptAnswer {
  question: Types.ObjectId;
  selectedOptionId: string;
  isCorrect: boolean;
  marksAwarded: number;
}

export interface IAssessmentAttempt {
  _id: Types.ObjectId;
  assessment: Types.ObjectId;
  course: Types.ObjectId;
  module?: Types.ObjectId;
  student: Types.ObjectId;
  enrollment: Types.ObjectId;
  clientAttemptId: string;
  answers: IAttemptAnswer[];
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  status: AttemptStatus;
  attemptNumber: number;
  startedAt: Date;
  submittedAt?: Date;
  durationSeconds?: number;
  offlineSynced: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const assessmentAttemptSchema = new Schema<IAssessmentAttempt>(
  {
    assessment: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    module: { type: Schema.Types.ObjectId, ref: 'Module' },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    enrollment: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true, index: true },
    clientAttemptId: { type: String, required: true },
    answers: [
      new Schema(
        {
          question: { type: Schema.Types.ObjectId, ref: 'Question' },
          selectedOptionId: String,
          isCorrect: Boolean,
          marksAwarded: Number,
        },
        { _id: false },
      ),
    ],
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    percent: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    status: { type: String, enum: ATTEMPT_STATUS, default: 'in_progress', index: true },
    attemptNumber: { type: Number, default: 1 },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date },
    durationSeconds: { type: Number },
    offlineSynced: { type: Boolean, default: false },
  },
  baseSchemaOptions,
);

assessmentAttemptSchema.index({ assessment: 1, student: 1 });
assessmentAttemptSchema.index({ student: 1, clientAttemptId: 1 }, { unique: true });

export const AssessmentAttempt = defineModel<IAssessmentAttempt>('AssessmentAttempt', assessmentAttemptSchema);
