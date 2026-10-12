/**
 * Ingest every supported source book under CONTENT_ROOT into draft courses.
 *
 *   npm run ingest
 *   npm run ingest -- --root "D:\\RTB\\RTB" --level L4 --limit 5
 *   npm run ingest -- --user admin@ishconnect.local
 *
 * For each file a SourceBook + BookProcessingJob is created and processed by
 * the shared pipeline. Existing files (matched by checksum) are skipped, so the
 * command is safe to re-run. Production courses remain DRAFT until reviewed.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { connectDatabase, disconnectDatabase } from '../db/connect';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { checksum } from '../lib/ids';
import { BookProcessingJob, SourceBook, User } from '../models';
import { createBookRecord, enqueueBookProcessing } from '../services/books/ingest.service';
import type { CourseLevel } from '../models/enums';

const SUPPORTED = new Set(['.pdf', '.docx', '.doc', '.txt', '.md']);
const LEVELS: Record<string, CourseLevel> = {
  l3: 'L3',
  l4: 'L4',
  l5: 'L5',
  general: 'General',
  'general modules': 'General',
  professional: 'Professional',
};

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function inferLevel(relPath: string): CourseLevel {
  const segments = relPath.split(/[\\/]/).map((s) => s.toLowerCase().trim());
  for (const seg of segments) {
    if (LEVELS[seg]) return LEVELS[seg];
    if (/^l[345]/.test(seg)) return seg.slice(0, 2).toUpperCase() as CourseLevel;
  }
  return 'Other';
}

function inferTitle(file: string): string {
  return path
    .basename(file, path.extname(file))
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.')) continue;
      out.push(...(await walk(full)));
    } else if (SUPPORTED.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

async function resolveUploader(email?: string) {
  if (email) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) throw new Error(`No user found with email ${email}`);
    return user;
  }
  const admin = await User.findOne({ role: { $in: ['platform_owner', 'platform_admin'] } }).sort({ createdAt: 1 });
  if (!admin) throw new Error('No platform administrator found. Run `npm run create-admin` first.');
  return admin;
}

async function waitForJobs(jobIds: string[], timeoutMs = 30 * 60 * 1000): Promise<void> {
  const start = Date.now();
  while (true) {
    const pending = await BookProcessingJob.countDocuments({
      _id: { $in: jobIds },
      status: { $nin: ['review', 'failed'] },
    });
    if (pending === 0) return;
    if (Date.now() - start > timeoutMs) {
      logger.warn({ pending }, 'Timed out waiting for book processing jobs');
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function main(): Promise<void> {
  const root = path.resolve(process.cwd(), arg('root') || env.CONTENT_ROOT);
  const levelFilter = arg('level')?.toUpperCase();
  const limit = arg('limit') ? Number(arg('limit')) : Infinity;

  await connectDatabase();
  const uploader = await resolveUploader(arg('user'));
  logger.info({ root, uploader: uploader.email }, 'Scanning content root');

  const stat = await fs.stat(root).catch(() => null);
  if (!stat || !stat.isDirectory()) throw new Error(`CONTENT_ROOT is not a directory: ${root}`);

  const files = await walk(root);
  logger.info({ found: files.length }, 'Source files discovered');

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  const jobIds: string[] = [];

  for (const file of files) {
    if (processed >= limit) break;
    const rel = path.relative(root, file);
    const level = inferLevel(rel);
    if (levelFilter && level !== levelFilter) continue;

    try {
      const buffer = await fs.readFile(file);
      const digest = checksum(buffer);
      const existing = await SourceBook.findOne({ checksum: digest }).select('_id').lean();
      if (existing) {
        skipped += 1;
        continue;
      }
      const { book, job } = await createBookRecord({
        originalname: path.basename(file),
        buffer,
        size: buffer.length,
        uploadedBy: String(uploader._id),
        hints: { title: inferTitle(file), level, category: level === 'General' ? 'General' : 'Software Development' },
      });
      enqueueBookProcessing(String(job._id));
      jobIds.push(String(job._id));
      processed += 1;
      logger.info({ book: book.title, level, file: rel }, 'Queued book for processing');
    } catch (err) {
      failed += 1;
      logger.error({ err, file: rel }, 'Failed to ingest file');
    }
  }

  logger.info({ processed, skipped, failed, jobs: jobIds.length }, 'Waiting for processing to finish');
  await waitForJobs(jobIds);

  const done = await BookProcessingJob.find({ _id: { $in: jobIds } }).select('status result.error').lean();
  const summary = done.reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] || 0) + 1;
    return acc;
  }, {});
  logger.info({ processed, skipped, failed, jobStatus: summary }, 'Ingestion complete — drafts await review');
  await disconnectDatabase();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, 'ingest failed');
    process.exit(1);
  });
