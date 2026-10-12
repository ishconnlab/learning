import { Schema, Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './base';
import { CONTENT_SOURCE_KIND, ContentSourceKind, DIFFICULTY, Difficulty, LESSON_KIND, LessonKind } from './enums';

export interface ISourceRef {
  page?: number;
  chapter?: string;
  section?: string;
  quote?: string;
}

const sourceRefSchema = new Schema<ISourceRef>(
  { page: Number, chapter: String, section: String, quote: String },
  { _id: false },
);

export interface IModule {
  _id: Types.ObjectId;
  course: Types.ObjectId;
  version?: Types.ObjectId;
  order: number;
  title: string;
  code?: string;
  summary: string;
  learningObjectives: string[];
  competencies: string[];
  estimatedMinutes: number;
  theoryPercent: number;
  practicePercent: number;
  prerequisites: Types.ObjectId[];
  sourceRef: ISourceRef;
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
}

const moduleSchema = new Schema<IModule>(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    version: { type: Schema.Types.ObjectId, ref: 'CourseVersion' },
    order: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    summary: { type: String, default: '' },
    learningObjectives: { type: [String], default: [] },
    competencies: { type: [String], default: [] },
    estimatedMinutes: { type: Number, default: 120 },
    theoryPercent: { type: Number, default: 20 },
    practicePercent: { type: Number, default: 80 },
    prerequisites: [{ type: Schema.Types.ObjectId, ref: 'Module' }],
    sourceRef: { type: sourceRefSchema, default: {} },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  },
  baseSchemaOptions,
);

moduleSchema.index({ course: 1, order: 1 }, { unique: true });

export const Module = defineModel<IModule>('Module', moduleSchema);

export interface IContentBlock {
  type: 'heading' | 'paragraph' | 'list' | 'code' | 'note' | 'definition' | 'example' | 'diagram' | 'table' | 'quote';
  text?: string;
  items?: string[];
  language?: string;
  sourcePage?: number;
}

const contentBlockSchema = new Schema<IContentBlock>(
  {
    type: {
      type: String,
      enum: ['heading', 'paragraph', 'list', 'code', 'note', 'definition', 'example', 'diagram', 'table', 'quote'],
      required: true,
    },
    text: String,
    items: [String],
    language: String,
    sourcePage: Number,
  },
  { _id: false },
);

export interface ILesson {
  _id: Types.ObjectId;
  course: Types.ObjectId;
  module: Types.ObjectId;
  order: number;
  kind: LessonKind;
  title: string;
  content: IContentBlock[];
  sourceRef: ISourceRef;
  contentSourceKind: ContentSourceKind;
  estimatedMinutes: number;
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
}

const lessonSchema = new Schema<ILesson>(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    module: { type: Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
    order: { type: Number, required: true },
    kind: { type: String, enum: LESSON_KIND, required: true, index: true },
    title: { type: String, required: true, trim: true },
    content: { type: [contentBlockSchema], default: [] },
    sourceRef: { type: sourceRefSchema, default: {} },
    contentSourceKind: { type: String, enum: CONTENT_SOURCE_KIND, default: 'summary' },
    estimatedMinutes: { type: Number, default: 20 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  },
  baseSchemaOptions,
);

lessonSchema.index({ module: 1, order: 1 }, { unique: true });

export const Lesson = defineModel<ILesson>('Lesson', lessonSchema);

export interface ILearningResource {
  _id: Types.ObjectId;
  course: Types.ObjectId;
  module?: Types.ObjectId;
  lesson?: Types.ObjectId;
  title: string;
  type: 'pdf' | 'docx' | 'image' | 'video' | 'audio' | 'link' | 'file';
  url?: string;
  storageKey?: string;
  mimeType?: string;
  sizeBytes?: number;
  sourceRef: ISourceRef;
  createdAt: Date;
  updatedAt: Date;
}

const learningResourceSchema = new Schema<ILearningResource>(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    module: { type: Schema.Types.ObjectId, ref: 'Module', index: true },
    lesson: { type: Schema.Types.ObjectId, ref: 'Lesson', index: true },
    title: { type: String, required: true },
    type: { type: String, enum: ['pdf', 'docx', 'image', 'video', 'audio', 'link', 'file'], required: true },
    url: String,
    storageKey: String,
    mimeType: String,
    sizeBytes: Number,
    sourceRef: { type: sourceRefSchema, default: {} },
  },
  baseSchemaOptions,
);

export const LearningResource = defineModel<ILearningResource>('LearningResource', learningResourceSchema);

export interface IPracticalActivity {
  _id: Types.ObjectId;
  course: Types.ObjectId;
  module: Types.ObjectId;
  title: string;
  kind: 'guided' | 'independent';
  instructions: string;
  steps: { text: string; hint?: string }[];
  hints: string[];
  expectedOutcome: string;
  successCriteria: string[];
  sourceRefs: ISourceRef[];
  difficulty: Difficulty;
  marks: number;
  estimatedMinutes: number;
  requiresSubmission: boolean;
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
}

const practicalActivitySchema = new Schema<IPracticalActivity>(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    module: { type: Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
    title: { type: String, required: true },
    kind: { type: String, enum: ['guided', 'independent'], required: true, index: true },
    instructions: { type: String, default: '' },
    steps: [new Schema({ text: String, hint: String }, { _id: false })],
    hints: { type: [String], default: [] },
    expectedOutcome: { type: String, default: '' },
    successCriteria: { type: [String], default: [] },
    sourceRefs: { type: [sourceRefSchema], default: [] },
    difficulty: { type: String, enum: DIFFICULTY, default: 'medium' },
    marks: { type: Number, default: 10 },
    estimatedMinutes: { type: Number, default: 30 },
    requiresSubmission: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  },
  baseSchemaOptions,
);

export const PracticalActivity = defineModel<IPracticalActivity>('PracticalActivity', practicalActivitySchema);
export { sourceRefSchema };
