import { Schema, Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './base';
import { ENROLLMENT_STATUS, EnrollmentStatus } from './enums';

export interface IEnrollment {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  course: Types.ObjectId;
  school?: Types.ObjectId;
  classGroup?: Types.ObjectId;
  status: EnrollmentStatus;
  source: 'self' | 'school' | 'admin' | 'invitation';
  enrolledBy?: Types.ObjectId;
  enrolledAt: Date;
  completedAt?: Date;
  completedVersion?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const enrollmentSchema = new Schema<IEnrollment>(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    school: { type: Schema.Types.ObjectId, ref: 'School', index: true },
    classGroup: { type: Schema.Types.ObjectId, ref: 'ClassGroup', index: true },
    status: { type: String, enum: ENROLLMENT_STATUS, default: 'active', index: true },
    source: { type: String, enum: ['self', 'school', 'admin', 'invitation'], default: 'self' },
    enrolledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    enrolledAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    completedVersion: { type: Schema.Types.ObjectId, ref: 'CourseVersion' },
  },
  baseSchemaOptions,
);

enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });
enrollmentSchema.index({ course: 1, status: 1 });

export const Enrollment = defineModel<IEnrollment>('Enrollment', enrollmentSchema);

export interface IModuleProgress {
  module: Types.ObjectId;
  started: boolean;
  completed: boolean;
  lessonsRead: Types.ObjectId[];
  lessonsTotal: number;
  practicalCompleted: Types.ObjectId[];
  practicalTotal: number;
  assessmentPassed: boolean;
  assessmentBestPercent: number;
  updatedAt: Date;
}

export interface IStudentProgress {
  _id: Types.ObjectId;
  enrollment: Types.ObjectId;
  student: Types.ObjectId;
  course: Types.ObjectId;
  modules: IModuleProgress[];
  completionPercent: number;
  theoryCompletedPercent: number;
  practiceCompletedPercent: number;
  finalProjectTasksCompleted: number;
  timeSpentSeconds: number;
  lastActivityAt?: Date;
  certificateEligible: boolean;
  certificateIssued: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const moduleProgressSchema = new Schema<IModuleProgress>(
  {
    module: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
    started: { type: Boolean, default: false },
    completed: { type: Boolean, default: false },
    lessonsRead: [{ type: Schema.Types.ObjectId, ref: 'Lesson' }],
    lessonsTotal: { type: Number, default: 0 },
    practicalCompleted: [{ type: Schema.Types.ObjectId, ref: 'PracticalActivity' }],
    practicalTotal: { type: Number, default: 0 },
    assessmentPassed: { type: Boolean, default: false },
    assessmentBestPercent: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const studentProgressSchema = new Schema<IStudentProgress>(
  {
    enrollment: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true, unique: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    modules: { type: [moduleProgressSchema], default: [] },
    completionPercent: { type: Number, default: 0 },
    theoryCompletedPercent: { type: Number, default: 0 },
    practiceCompletedPercent: { type: Number, default: 0 },
    finalProjectTasksCompleted: { type: Number, default: 0 },
    timeSpentSeconds: { type: Number, default: 0 },
    lastActivityAt: { type: Date },
    certificateEligible: { type: Boolean, default: false, index: true },
    certificateIssued: { type: Boolean, default: false },
  },
  baseSchemaOptions,
);

studentProgressSchema.index({ student: 1, course: 1 }, { unique: true });

export const StudentProgress = defineModel<IStudentProgress>('StudentProgress', studentProgressSchema);
