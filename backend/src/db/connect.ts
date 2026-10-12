import mongoose from 'mongoose';
import { env } from '../config/env';
import { logger } from '../lib/logger';

mongoose.set('strictQuery', true);

let connectionPromise: Promise<typeof mongoose> | null = null;

export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (connectionPromise) return connectionPromise;

  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  const options = {
    serverSelectionTimeoutMS: 15000,
    maxPoolSize: 20,
  } as unknown as mongoose.ConnectOptions;

  connectionPromise = mongoose
    .connect(uri, options)
    .then((m) => {
      connectionPromise = null;
      return m;
    })
    .catch((err) => {
      connectionPromise = null;
      throw err;
    });

  return connectionPromise;
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export { mongoose };
