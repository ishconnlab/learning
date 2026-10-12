/**
 * Seed baseline, non-content data: platform administrator, default CMS pages
 * and (optionally) a demo school. It does NOT create sample courses — real
 * courses are produced by the book ingestion pipeline (`npm run ingest`).
 *
 *   npm run seed
 *   npm run seed -- --with-school
 */
import { connectDatabase, disconnectDatabase, mongoose } from '../db/connect';
import { logger } from '../lib/logger';
import { School } from '../models';
import { schoolCode } from '../lib/ids';
import { createOrPromoteAdmin } from './create-admin';
import { seedDefaultPages } from './cms-data';

export async function ensureIndexes(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}

async function main(): Promise<void> {
  const withSchool = process.argv.includes('--with-school');
  await connectDatabase();

  const admin = await createOrPromoteAdmin();
  const pages = await seedDefaultPages();
  await ensureIndexes();
  logger.info({ admin: admin.email, pages }, 'Baseline seed complete');

  if (withSchool) {
    const name = 'Demo TVET School';
    const existing = await School.findOne({ name });
    if (!existing) {
      await School.create({
        name,
        code: schoolCode('Demo TVET'),
        type: 'tvet',
        district: 'Kigali',
        province: 'Kigali City',
        createdBy: admin ? undefined : undefined,
      });
      logger.info({ school: 'Demo TVET School', owner: admin.email }, 'Demo school created');
      void School;
    } else {
      logger.info({ school: schoolCode('Demo TVET School') }, 'Demo school already exists');
    }
  }

  await disconnectDatabase();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, 'seed failed');
      process.exit(1);
    });
}
void School;
void schoolCode;
