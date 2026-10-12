import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['true', '1', 'yes', 'on'].includes(v.toLowerCase())));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('/api/v1'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/ishconnect_lms'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_NAME: z.string().default('ish_session'),
  COOKIE_DOMAIN: z.string().optional().default(''),
  COOKIE_SECURE: booleanish.default(false),
  CSRF_ENABLED: booleanish.default(true),

  ADMIN_EMAIL: z.string().email().optional().default('admin@ishconnect.local'),
  ADMIN_PASSWORD: z.string().optional().default(''),
  ADMIN_NAME: z.string().optional().default('Platform Administrator'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('./storage'),
  PUBLIC_API_URL: z.string().default('http://localhost:4000'),

  S3_ENDPOINT: z.string().optional().default(''),
  S3_REGION: z.string().optional().default('auto'),
  S3_BUCKET: z.string().optional().default(''),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
  S3_FORCE_PATH_STYLE: booleanish.default(true),
  S3_PUBLIC_BASE_URL: z.string().optional().default(''),

  UPLOAD_MAX_MB: z.coerce.number().positive().default(200),
  OCR_ENABLED: booleanish.default(true),
  OCR_LANGUAGES: z.string().default('eng'),
  BOOK_CACHE_DIR: z.string().default('./storage/book-cache'),

  CERTIFICATE_VERIFY_BASE_URL: z.string().default('http://localhost:5173/verify'),
  CERTIFICATE_DIR: z.string().default('./storage/certificates'),

  CONTENT_ROOT: z.string().default('..'),
  SEED_ADMIN_EMAIL: z.string().email().optional().default('admin@ishconnect.local'),
  SEED_ADMIN_PASSWORD: z.string().optional().default('ChangeMe123!'),
});

export type AppEnv = z.infer<typeof envSchema>;

function loadEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    console.error(`\n[config] Invalid environment configuration:\n${issues}\n`);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    // In dev, provide a sane fallback secret so the app can still boot.
    return envSchema.parse({
      ...process.env,
      JWT_SECRET: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
    });
  }
  return parsed.data;
}

export const env = loadEnv();

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

export const paths = {
  storage: path.resolve(process.cwd(), env.LOCAL_STORAGE_DIR),
  bookCache: path.resolve(process.cwd(), env.BOOK_CACHE_DIR),
  certificates: path.resolve(process.cwd(), env.CERTIFICATE_DIR),
};
