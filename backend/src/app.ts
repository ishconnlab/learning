import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { apiLimiter, corsMiddleware, csrfMiddleware, helmetMiddleware } from './middleware/security';
import { errorHandler, notFoundHandler } from './middleware/error';
import routes from './routes';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));
  app.use(cookieParser());

  if (env.NODE_ENV !== 'test') {
    app.use(pinoHttp({ logger }));
  }

  app.get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', service: 'ishconnect-lms', uptime: process.uptime() } });
  });

  const api = express.Router();
  api.use(apiLimiter);
  api.use(csrfMiddleware);
  api.get('/', (_req, res) => {
    res.json({ success: true, data: { name: 'IshConnect LMS API', version: 'v1' } });
  });
  api.use(routes);

  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
