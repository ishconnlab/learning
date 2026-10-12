import { Schema, Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './base';
import { CERTIFICATE_STATUS, CertificateStatus, COURSE_LEVELS, CourseLevel } from './enums';

export interface ICertificate {
  _id: Types.ObjectId;
  certificateId: string;
  student: Types.ObjectId;
  studentName: string;
  enrollment: Types.ObjectId;
  course: Types.ObjectId;
  courseVersion?: Types.ObjectId;
  courseTitle: string;
  courseLevel: CourseLevel;
  school?: Types.ObjectId;
  institutionName: string;
  logoUrl?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  signatureUrl?: string;
  sealUrl?: string;
  completionDate: Date;
  issuedAt: Date;
  achievementGrade?: string;
  durationHours?: number;
  status: CertificateStatus;
  verifyUrl: string;
  pdfKey?: string;
  completionSnapshot: {
    completionPercent: number;
    averageAssessmentPercent: number;
    projectTasksCompleted: number;
  };
  issuedBy: Types.ObjectId;
  revokedAt?: Date;
  revocationReason?: string;
  supersededBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const certificateSchema = new Schema<ICertificate>(
  {
    certificateId: { type: String, required: true, unique: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentName: { type: String, required: true },
    enrollment: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    courseVersion: { type: Schema.Types.ObjectId, ref: 'CourseVersion' },
    courseTitle: { type: String, required: true },
    courseLevel: { type: String, enum: COURSE_LEVELS, required: true },
    school: { type: Schema.Types.ObjectId, ref: 'School' },
    institutionName: { type: String, required: true },
    logoUrl: { type: String },
    signatoryName: { type: String },
    signatoryTitle: { type: String },
    signatureUrl: { type: String },
    sealUrl: { type: String },
    completionDate: { type: Date, required: true },
    issuedAt: { type: Date, default: Date.now },
    achievementGrade: { type: String },
    durationHours: { type: Number },
    status: { type: String, enum: CERTIFICATE_STATUS, default: 'issued', index: true },
    verifyUrl: { type: String, required: true },
    pdfKey: { type: String },
    completionSnapshot: {
      completionPercent: { type: Number, default: 0 },
      averageAssessmentPercent: { type: Number, default: 0 },
      projectTasksCompleted: { type: Number, default: 0 },
    },
    issuedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    revokedAt: { type: Date },
    revocationReason: { type: String },
    supersededBy: { type: Schema.Types.ObjectId, ref: 'Certificate' },
  },
  baseSchemaOptions,
);

/** One active certificate per enrollment unless explicitly reissued. */
certificateSchema.index({ enrollment: 1, status: 1 });

export const Certificate = defineModel<ICertificate>('Certificate', certificateSchema);

export interface ICertificateRevocation {
  _id: Types.ObjectId;
  certificate: Types.ObjectId;
  certificateId: string;
  type: 'revocation' | 'reissue';
  reason: string;
  revokedBy: Types.ObjectId;
  revokedAt: Date;
  supersededBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const certificateRevocationSchema = new Schema<ICertificateRevocation>(
  {
    certificate: { type: Schema.Types.ObjectId, ref: 'Certificate', required: true, index: true },
    certificateId: { type: String, required: true, index: true },
    type: { type: String, enum: ['revocation', 'reissue'], default: 'revocation' },
    reason: { type: String, required: true },
    revokedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    revokedAt: { type: Date, default: Date.now },
    supersededBy: { type: Schema.Types.ObjectId, ref: 'Certificate' },
  },
  baseSchemaOptions,
);

export const CertificateRevocation = defineModel<ICertificateRevocation>('CertificateRevocation', certificateRevocationSchema);
