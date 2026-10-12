import { customAlphabet } from 'nanoid';
import crypto from 'crypto';

const upper = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);
const slugSafe = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);

export function randomCode(length = 8): string {
  return upper().slice(0, length);
}

export function nonGuessingToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Human-friendly, non-guessable certificate identifier. */
export function certificateId(): string {
  return `ISH-CERT-${upper()}`;
}

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${base || 'course'}-${slugSafe().slice(0, 5)}`;
}

export function schoolCode(name: string): string {
  const prefix = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(3, 'X');
  return `${prefix}-${randomCode(4)}`;
}

export function checksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function idempotencyKey(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(16).toString('hex')}`;
}
