import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { NotFound } from '../lib/errors';
import { optionalAuth } from '../middleware/auth';
import { storage } from '../services/storage';

const router = Router();

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

router.get(
  '/*',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const raw = String(req.params[0] || '');
    const key = decodeURIComponent(raw).replace(/^\/+/, '');
    if (!key) throw NotFound('File not found');
    const isPublic = key.startsWith('public/') || key.startsWith('cms/');
    if (!isPublic && !req.auth) {
      res.status(401).json({ success: false, error: { code: 'unauthorized', message: 'Authentication required' } });
      return;
    }
    const buffer = await storage().get(key);
    const ext = key.slice(key.lastIndexOf('.')).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', isPublic ? 'public, max-age=86400' : 'private, max-age=3600');
    res.send(buffer);
  }),
);

export default router;
