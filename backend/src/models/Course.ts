import { Schema, Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './base';
import { COURSE_LEVELS, COURSE_STATUS, CourseLevel, CourseStatus } from './enums';

export interface ICourse {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  code: string;
  summary: string;
  description?: string;
  level: CourseLevel;
  category: string;
  subject: string;
  language: string;
  status: CourseStatus;
  sourceBook?: Types.ObjectId;
  activeVersion?: Types.ObjectId;
  ownerSchool?: Types.ObjectId;
  createdBy: Types.ObjectId;
  publishedAt?: Date;
  /** Relative emphasis targets for the 20/80 learning design. */
  theoryPercent: number;
  practicePercent: number;
  tags: string[];
  featured: boolean;
  thumbnailUrl?: string;
  estimatedHours?: number;
  certificateEligible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const courseSchema = new Schema<ICourse>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    code: { type: String, required: true, trim: true, index: true },
    summary: { type: String, default: '' },
    description: { type: String },
    level: { type: String, enum: COURSE_LEVELS, required: true, index: true },
    category: { type: String, default: 'Software Development', index: true },
    subject: { type: String, default: '', index: true },
    language: { type: String, default: 'en' },
    status: { type: String, enum: COURSE_STATUS, default: 'draft', index: true },
    sourceBook: { type: Schema.Types.ObjectId, ref: 'SourceBook', index: true },
    activeVersion: { type: Schema.Types.ObjectId, ref: 'CourseVersion' },
    ownerSchool: { type: Schema.Types.ObjectId, ref: 'School', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    publishedAt: { type: Date },
    theoryPercent: { type: Number, default: 20, min: 0, max: 100 },
    practicePercent: { type: Number, default: 80, min: 0, max: 100 },
    tags: [{ type: String }],
    featured: { type: Boolean, default: false, index: true },
    thumbnailUrl: { type: String },
    estimatedHours: { type: Number },
    certificateEligible: { type: Boolean, default: true },
  },
  baseSchemaOptions,
);

courseSchema.index({ title: 'text', summary: 'text', tags: 'text' });
courseSchema.index({ level: 1, category: 1, status: 1 });
courseSchema.index({ code: 1, ownerSchool: 1 });

export const Course = defineModel<ICourse>('Course', courseSchema);

export interface ICourseVersion {
  _id: Types.ObjectId;
  course: Types.ObjectId;
  version: number;
  status: CourseStatus;
  sourceBook?: Types.ObjectId;
  sourceEdition?: string;
  /** Ordered module references for this immutable version snapshot. */
  modules: Types.ObjectId[];
  changelog?: string;
  publishedAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const courseVersionSchema = new Schema<ICourseVersion>(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    version: { type: Number, required: true },
    status: { type: String, enum: COURSE_STATUS, default: 'draft' },
    sourceBook: { type: Schema.Types.ObjectId, ref: 'SourceBook' },
    sourceEdition: { type: String },
    modules: [{ type: Schema.Types.ObjectId, ref: 'Module' }],
    changelog: { type: String },
    publishedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  baseSchemaOptions,
);

courseVersionSchema.index({ course: 1, version: 1 }, { unique: true });

export const CourseVersion = defineModel<ICourseVersion>('CourseVersion', courseVersionSchema);
