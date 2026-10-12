import { Schema, Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './base';
import { BOOK_JOB_STATUS, BookJobStatus, COURSE_LEVELS, CourseLevel } from './enums';

export interface IBookTocEntry {
  title: string;
  level: number;
  page?: number;
  children: IBookTocEntry[];
}

export interface ISourceBook {
  _id: Types.ObjectId;
  title: string;
  author?: string;
  edition?: string;
  publisher?: string;
  year?: number;
  isbn?: string;
  language: string;
  level: CourseLevel;
  subject?: string;
  category?: string;
  moduleCode?: string;

  originalFilename: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  pageCount?: number;

  status: 'uploaded' | 'processing' | 'ready' | 'failed' | 'archived';
  usedOcr: boolean;
  charCount: number;
  detectedMetadata: {
    guessedTitle?: string;
    guessedAuthor?: string;
    tableOfContents: IBookTocEntry[];
    learningObjectives: string[];
    units: { title: string; page?: number; kind?: string }[];
  };

  /** Copyright / permission handling. */
  rights: {
    licenseNote?: string;
    copyrightConfirmed: boolean;
    accessLevel: 'platform' | 'school' | 'enrolled_only';
  };

  uploadedBy: Types.ObjectId;
  course?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const tocEntry = new Schema<IBookTocEntry>(
  {
    title: { type: String, required: true },
    level: { type: Number, default: 1 },
    page: { type: Number },
    children: [{ type: Schema.Types.Mixed }],
  },
  { _id: false },
);

const sourceBookSchema = new Schema<ISourceBook>(
  {
    title: { type: String, required: true, trim: true, index: true },
    author: { type: String, trim: true },
    edition: { type: String, trim: true },
    publisher: { type: String, trim: true },
    year: { type: Number },
    isbn: { type: String, trim: true },
    language: { type: String, default: 'en' },
    level: { type: String, enum: COURSE_LEVELS, default: 'Other', index: true },
    subject: { type: String, trim: true },
    category: { type: String, trim: true, index: true },
    moduleCode: { type: String, trim: true, index: true },

    originalFilename: { type: String, required: true },
    storageKey: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    checksum: { type: String, index: true },
    pageCount: { type: Number },

    status: { type: String, enum: ['uploaded', 'processing', 'ready', 'failed', 'archived'], default: 'uploaded', index: true },
    usedOcr: { type: Boolean, default: false },
    charCount: { type: Number, default: 0 },
    detectedMetadata: {
      guessedTitle: { type: String },
      guessedAuthor: { type: String },
      tableOfContents: { type: [tocEntry], default: [] },
      learningObjectives: { type: [String], default: [] },
      units: { type: [new Schema({ title: String, page: Number, kind: String }, { _id: false })], default: [] },
    },

    rights: {
      licenseNote: { type: String },
      copyrightConfirmed: { type: Boolean, default: false },
      accessLevel: { type: String, enum: ['platform', 'school', 'enrolled_only'], default: 'enrolled_only' },
    },

    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', index: true },
  },
  baseSchemaOptions,
);

sourceBookSchema.index({ title: 'text', author: 'text', subject: 'text' });

export const SourceBook = defineModel<ISourceBook>('SourceBook', sourceBookSchema);

export interface IBookProcessingJob {
  _id: Types.ObjectId;
  book: Types.ObjectId;
  status: BookJobStatus;
  progress: number;
  steps: { name: string; status: 'pending' | 'active' | 'done' | 'failed'; message?: string; at?: Date }[];
  logs: { at: Date; level: string; message: string }[];
  error?: string;
  result?: {
    modulesCreated: number;
    lessonsCreated: number;
    questionsCreated: number;
    warnings: string[];
  };
  startedAt?: Date;
  finishedAt?: Date;
  requestedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const bookProcessingJobSchema = new Schema<IBookProcessingJob>(
  {
    book: { type: Schema.Types.ObjectId, ref: 'SourceBook', required: true, index: true },
    status: { type: String, enum: BOOK_JOB_STATUS, default: 'queued', index: true },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    steps: [
      new Schema(
        { name: String, status: { type: String, default: 'pending' }, message: String, at: Date },
        { _id: false },
      ),
    ],
    logs: [new Schema({ at: { type: Date, default: Date.now }, level: String, message: String }, { _id: false })],
    error: { type: String },
    result: {
      modulesCreated: { type: Number, default: 0 },
      lessonsCreated: { type: Number, default: 0 },
      questionsCreated: { type: Number, default: 0 },
      warnings: { type: [String], default: [] },
    },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  baseSchemaOptions,
);

export const BookProcessingJob = defineModel<IBookProcessingJob>('BookProcessingJob', bookProcessingJobSchema);
