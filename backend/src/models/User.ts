import bcrypt from 'bcryptjs';
import { Schema, Types } from 'mongoose';
import { baseSchemaOptions, defineModel } from './base';
import { ROLES, Role } from './enums';

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  status: 'active' | 'suspended' | 'invited';
  phone?: string;
  avatarUrl?: string;
  preferredLanguage: string;
  emailVerified: boolean;
  lastLoginAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'student', index: true },
    status: { type: String, enum: ['active', 'suspended', 'invited'], default: 'active', index: true },
    phone: { type: String, trim: true },
    avatarUrl: { type: String },
    preferredLanguage: { type: String, default: 'en' },
    emailVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
  },
  baseSchemaOptions,
);

userSchema.methods.comparePassword = function comparePassword(candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export const User = defineModel<IUser>('User', userSchema);
