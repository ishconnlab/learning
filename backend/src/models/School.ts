import { Schema, Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './base';

export interface ISchool {
  _id: Types.ObjectId;
  name: string;
  code: string;
  type: 'tvet' | 'secondary' | 'university' | 'training_center' | 'other';
  email?: string;
  phone?: string;
  address?: string;
  district?: string;
  province?: string;
  logoUrl?: string;
  websiteUrl?: string;
  status: 'active' | 'inactive' | 'suspended';
  settings: {
    defaultLanguage: string;
    allowSelfRegistration: boolean;
    requireEnrollmentApproval: boolean;
  };
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schoolSchema = new Schema<ISchool>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    type: {
      type: String,
      enum: ['tvet', 'secondary', 'university', 'training_center', 'other'],
      default: 'tvet',
    },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    district: { type: String, trim: true },
    province: { type: String, trim: true },
    logoUrl: { type: String },
    websiteUrl: { type: String },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active', index: true },
    settings: {
      defaultLanguage: { type: String, default: 'en' },
      allowSelfRegistration: { type: Boolean, default: false },
      requireEnrollmentApproval: { type: Boolean, default: true },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions,
);

export const School = defineModel<ISchool>('School', schoolSchema);

export interface ISchoolMembership {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  school: Types.ObjectId;
  role: 'school_admin' | 'teacher' | 'student';
  status: 'invited' | 'active' | 'suspended' | 'removed';
  title?: string;
  invitedBy?: Types.ObjectId;
  joinedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schoolMembershipSchema = new Schema<ISchoolMembership>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    school: { type: Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    role: { type: String, enum: ['school_admin', 'teacher', 'student'], required: true },
    status: { type: String, enum: ['invited', 'active', 'suspended', 'removed'], default: 'active' },
    title: { type: String },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    joinedAt: { type: Date },
  },
  baseSchemaOptions,
);

schoolMembershipSchema.index({ user: 1, school: 1 }, { unique: true });
schoolMembershipSchema.index({ school: 1, role: 1, status: 1 });

export const SchoolMembership = defineModel<ISchoolMembership>('SchoolMembership', schoolMembershipSchema);
