import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { SchoolMembership } from '../models/School';
import { hashPassword, User } from '../models/User';
import type { Role } from '../models/enums';
import { Unauthorized } from '../lib/errors';

function secret(): string {
  return process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';
}

export function signToken(user: { _id: unknown; role: Role }): string {
  return jwt.sign({ sub: String(user._id), role: user.role }, secret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
}

export function verifyToken(token: string): { sub: string; role: Role } {
  return jwt.verify(token, secret()) as { sub: string; role: Role };
}

export async function getSchoolIds(userId: string): Promise<string[]> {
  const memberships = await SchoolMembership.find({ user: userId, status: 'active' }).select('school').lean();
  return memberships.map((m) => String(m.school));
}

export async function registerStudent(input: { email: string; name: string; password: string }) {
  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    email: input.email.toLowerCase(),
    name: input.name,
    passwordHash,
    role: 'student',
  });
  return user;
}

/**
 * Create a user with an explicit role. Callers MUST be authorized to grant the
 * role (e.g. platform admin creating a school admin). Never call from public input.
 */
export async function createUserWithRole(input: {
  email: string;
  name: string;
  password: string;
  role: Role;
}) {
  const passwordHash = await hashPassword(input.password);
  return User.create({
    email: input.email.toLowerCase(),
    name: input.name,
    passwordHash,
    role: input.role,
    emailVerified: true,
  });
}

export async function authenticateCredentials(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) throw Unauthorized('Invalid email or password');
  if (user.status === 'suspended') throw Unauthorized('Account suspended');
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw Unauthorized('Account temporarily locked. Try again later.');
  }
  const valid = await user.comparePassword(password);
  if (!valid) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= 8) {
      user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    throw Unauthorized('Invalid email or password');
  }
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

export async function setPassword(userId: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  await User.updateOne({ _id: userId }, { $set: { passwordHash, passwordResetTokenHash: null } }).select('+passwordHash');
}

export async function createPasswordReset(email: string): Promise<string | null> {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) return null;
  const raw = await bcrypt.hash(user.id, 10);
  const token = Buffer.from(`${user.id}.${raw}`).toString('base64url');
  await User.updateOne(
    { _id: user.id },
    { $set: { passwordResetTokenHash: raw, passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000) } },
  );
  return token;
}

export async function consumePasswordReset(token: string, password: string): Promise<void> {
  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    throw Unauthorized('Invalid or expired reset token');
  }
  const [userId, raw] = decoded.split('.');
  if (!userId || !raw) throw Unauthorized('Invalid or expired reset token');
  const user = await User.findOne({
    _id: userId,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetTokenHash');
  if (!user || !user.passwordResetTokenHash) throw Unauthorized('Invalid or expired reset token');
  const valid = await bcrypt.compare(user.id, user.passwordResetTokenHash);
  if (!valid) throw Unauthorized('Invalid or expired reset token');
  const passwordHash = await hashPassword(password);
  await User.updateOne(
    { _id: user.id },
    { $set: { passwordHash, passwordResetTokenHash: null, passwordResetExpires: null } },
  );
}
