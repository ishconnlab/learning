import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './db/connect';
import { logger } from './lib/logger';
import { BookProcessingJob } from './models';
import { enqueueBookProcessing } from './services/books/ingest.service';

async function resumePendingJobs(): Promise<void> {
  const pending = await BookProcessingJob.find({ status: { $in: ['queued', 'validating', 'extracting', 'structuring'] } })
    .select('_id')
    .lean();
  for (const job of pending) {
    logger.info({ jobId: String(job._id) }, 'Resuming book processing job');
    enqueueBookProcessing(String(job._id));
  }
}

async function main(): Promise<void> {
  await connectDatabase();
  await resumePendingJobs().catch((err) => logger.warn({ err }, 'Could not resume pending jobs'));

  const app = createApp();
  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'IshConnect LMS API listening');
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      disconnectDatabase()
        .catch((err) => logger.error({ err }, 'Error during shutdown'))
        .finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled rejection'));
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception');
    shutdown('uncaughtException');
  });
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
