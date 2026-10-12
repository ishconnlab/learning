import { Schema, Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './base';
import { COURSE_LEVELS, CourseLevel } from './enums';

export interface IClassGroup {
  _id: Types.ObjectId;
  school: Types.ObjectId;
  name: string;
  code: string;
  level: CourseLevel;
  academicYear: string;
  courses: Types.ObjectId[];
  teachers: Types.ObjectId[];
  students: Types.ObjectId[];
  status: 'active' | 'archived';
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const classGroupSchema = new Schema<IClassGroup>(
  {
    school: { type: Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    level: { type: String, enum: COURSE_LEVELS, default: 'Other', index: true },
    academicYear: { type: String, required: true, trim: true },
    courses: [{ type: Schema.Types.ObjectId, ref: 'Course', index: true }],
    teachers: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    students: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions,
);

classGroupSchema.index({ school: 1, code: 1, academicYear: 1 }, { unique: true });

export const ClassGroup = defineModel<IClassGroup>('ClassGroup', classGroupSchema);
