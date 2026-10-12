import pino from 'pino';
import { env, isTest } from '../config/env';

export const logger = pino({
  level: isTest ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        }
      : undefined,
  base: undefined,
});
