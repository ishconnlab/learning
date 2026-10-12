import multer from 'multer';
import { env } from '../config/env';
import { BadRequest } from '../lib/errors';

const ALLOWED = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/tiff',
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_MB * 1024 * 1024, files: 10 },
  fileFilter(_req, file, cb) {
    if (ALLOWED.has(file.mimetype)) return cb(null, true);
    cb(BadRequest(`Unsupported file type: ${file.mimetype}`));
  },
});

export const submissionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
});
