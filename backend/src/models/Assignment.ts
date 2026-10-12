import { Schema, Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './base';
import { SUBMISSION_STATUS, SubmissionStatus } from './enums';

export interface IRubricCriterion {
  criterion: string;
  marks: number;
  description?: string;
}

const rubricSchema = new Schema<IRubricCriterion>(
  { criterion: { type: String, required: true }, marks: { type: Number, required: true }, description: String },
  { _id: false },
);

export interface IAssignment {
  _id: Types.ObjectId;
  course: Types.ObjectId;
  module?: Types.ObjectId;
  classGroups: Types.ObjectId[];
  title: string;
  instructions: string;
  deliverables: string[];
  attachments: { title: string; url: string; type: string }[];
  startAt?: Date;
  dueAt?: Date;
  allowLate: boolean;
  latePenaltyPercent: number;
  marks: number;
  rubric: IRubricCriterion[];
  status: 'draft' | 'published' | 'archived';
  version: number;
  deadlineHistory: { changedAt: Date; changedBy: Types.ObjectId; from?: Date; to?: Date }[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const assignmentSchema = new Schema<IAssignment>(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    module: { type: Schema.Types.ObjectId, ref: 'Module' },
    classGroups: [{ type: Schema.Types.ObjectId, ref: 'ClassGroup', index: true }],
    title: { type: String, required: true },
    instructions: { type: String, default: '' },
    deliverables: { type: [String], default: [] },
    attachments: [
      new Schema({ title: String, url: String, type: String }, { _id: false }),
    ],
    startAt: { type: Date },
    dueAt: { type: Date },
    allowLate: { type: Boolean, default: false },
    latePenaltyPercent: { type: Number, default: 0, min: 0, max: 100 },
    marks: { type: Number, default: 100 },
    rubric: { type: [rubricSchema], default: [] },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    version: { type: Number, default: 1 },
    deadlineHistory: [
      new Schema({ changedAt: Date, changedBy: { type: Schema.Types.ObjectId, ref: 'User' }, from: Date, to: Date }, { _id: false }),
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  baseSchemaOptions,
);

export const Assignment = defineModel<IAssignment>('Assignment', assignmentSchema);

export interface IAssignmentSubmission {
  _id: Types.ObjectId;
  assignment: Types.ObjectId;
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

const assignmentSubmissionSchema = new Schema<IAssignmentSubmission>(
  {
    assignment: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true, index: true },
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

assignmentSubmissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
assignmentSubmissionSchema.index({ student: 1, clientSubmissionId: 1 }, { unique: true });

export const AssignmentSubmission = defineModel<IAssignmentSubmission>('AssignmentSubmission', assignmentSubmissionSchema);
