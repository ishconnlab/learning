/**
 * First-run bootstrap: prepare a database for use.
 *
 *   npm run bootstrap
 *
 * Performs:
 *   1. platform administrator creation
 *   2. default CMS pages (landing, about, contact, privacy, terms)
 *   3. index creation for all collections
 *
 * After this, upload source books with `npm run ingest`.
 */
import { connectDatabase, disconnectDatabase, mongoose } from '../db/connect';
import { logger } from '../lib/logger';
import { createOrPromoteAdmin } from './create-admin';
import { seedDefaultPages } from './cms-data';

async function main(): Promise<void> {
  await connectDatabase();

  const admin = await createOrPromoteAdmin();
  const pages = await seedDefaultPages();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

  logger.info({ admin: admin.email, cmsPages: pages }, 'Bootstrap complete');
  logger.info('Next steps: 1) npm run ingest  2) npm run dev');
  await disconnectDatabase();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, 'bootstrap failed');
    process.exit(1);
  });
