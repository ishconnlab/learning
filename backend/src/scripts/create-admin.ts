/**
 * Create (or promote) the first platform administrator.
 *
 *   npm run create-admin
 *
 * Reads ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME (falling back to the
 * SEED_ADMIN_* values). Safe to re-run: an existing account is promoted to
 * `platform_owner` rather than duplicated.
 */
import { connectDatabase, disconnectDatabase } from '../db/connect';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { hashPassword, User } from '../models/User';

export async function createOrPromoteAdmin(): Promise<{ email: string; created: boolean }> {
  const email = (process.env.ADMIN_EMAIL || env.ADMIN_EMAIL || env.SEED_ADMIN_EMAIL).toLowerCase();
  const password = process.env.ADMIN_PASSWORD || env.ADMIN_PASSWORD || env.SEED_ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || env.ADMIN_NAME || 'Platform Administrator';

  if (!password || password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters');
  }

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== 'platform_owner' || existing.status !== 'active') {
      existing.role = 'platform_owner';
      existing.status = 'active';
      await existing.save();
      logger.info({ email }, 'Existing account promoted to platform_owner');
      return { email, created: false };
    }
    return { email, created: false };
  }

  await User.create({
    email,
    name,
    passwordHash: await hashPassword(password),
    role: 'platform_owner',
    status: 'active',
    emailVerified: true,
  });
  logger.info({ email }, 'Platform administrator created');
  return { email, created: true };
}

async function main(): Promise<void> {
  await connectDatabase();
  const result = await createOrPromoteAdmin();
  logger.info(result, 'Administrator ready');
  await disconnectDatabase();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, 'create-admin failed');
      process.exit(1);
    });
}
