import { Schema, Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './base';
import { SUBMISSION_STATUS, SubmissionStatus } from './enums';
import { ISourceRef, sourceRefSchema } from './Content';

export interface IFinalProject {
  _id: Types.ObjectId;
  course: Types.ObjectId;
  version?: Types.ObjectId;
  title: string;
  description: string;
  tasks: Types.ObjectId[];
  /** Exactly three tasks are required; enforced in service layer. */
  taskCount: number;
  status: 'draft' | 'published';
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const finalProjectSchema = new Schema<IFinalProject>(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, unique: true, index: true },
    version: { type: Schema.Types.ObjectId, ref: 'CourseVersion' },
    title: { type: String, default: 'Final Project' },
    description: { type: String, default: '' },
    tasks: [{ type: Schema.Types.ObjectId, ref: 'FinalProjectTask' }],
    taskCount: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  baseSchemaOptions,
);

export const FinalProject = defineModel<IFinalProject>('FinalProject', finalProjectSchema);

export interface IFinalProjectTask {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  course: Types.ObjectId;
  order: number;
  kind: 'foundational' | 'integrated' | 'capstone';
  title: string;
  instructions: string;
  deliverables: string[];
  acceptanceCriteria: string[];
  sourceRefs: ISourceRef[];
  marks: number;
  rubric: { criterion: string; marks: number }[];
  deadline?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const finalProjectTaskSchema = new Schema<IFinalProjectTask>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'FinalProject', required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    order: { type: Number, required: true, min: 1, max: 3 },
    kind: { type: String, enum: ['foundational', 'integrated', 'capstone'], required: true },
    title: { type: String, required: true },
    instructions: { type: String, default: '' },
    deliverables: { type: [String], default: [] },
    acceptanceCriteria: { type: [String], default: [] },
    sourceRefs: { type: [sourceRefSchema], default: [] },
    marks: { type: Number, default: 100 },
    rubric: { type: [new Schema({ criterion: String, marks: Number }, { _id: false })], default: [] },
    deadline: { type: Date },
  },
  baseSchemaOptions,
);

finalProjectTaskSchema.index({ project: 1, order: 1 }, { unique: true });

export const FinalProjectTask = defineModel<IFinalProjectTask>('FinalProjectTask', finalProjectTaskSchema);

export interface IProjectSubmission {
  _id: Types.ObjectId;
  task: Types.ObjectId;
  project: Types.ObjectId;
  course: Types.ObjectId;
  student: Types.ObjectId;
  enrollment: Types.ObjectId;
  clientSubmissionId: string;
  content: string;
  files: { key: string; name: string; size: number; mimeType: string }[];
  status: SubmissionStatus;
  isLate: boolean;
  submittedAt?: Date;
  grade?: number;
  feedback?: string;
  rubricScores: { criterion: string; marks: number }[];
  gradedBy?: Types.ObjectId;
  gradedAt?: Date;
  revisionNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

const projectSubmissionSchema = new Schema<IProjectSubmission>(
  {
    task: { type: Schema.Types.ObjectId, ref: 'FinalProjectTask', required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'FinalProject', required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    enrollment: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true },
    clientSubmissionId: { type: String, required: true },
    content: { type: String, default: '' },
    files: [new Schema({ key: String, name: String, size: Number, mimeType: String }, { _id: false })],
    status: { type: String, enum: SUBMISSION_STATUS, default: 'draft', index: true },
    isLate: { type: Boolean, default: false },
    submittedAt: { type: Date },
    grade: { type: Number },
    feedback: { type: String },
    rubricScores: [new Schema({ criterion: String, marks: Number }, { _id: false })],
    gradedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    gradedAt: { type: Date },
    revisionNumber: { type: Number, default: 1 },
  },
  baseSchemaOptions,
);

projectSubmissionSchema.index({ task: 1, student: 1 }, { unique: true });
projectSubmissionSchema.index({ student: 1, clientSubmissionId: 1 }, { unique: true });

export const ProjectSubmission = defineModel<IProjectSubmission>('ProjectSubmission', projectSubmissionSchema);
