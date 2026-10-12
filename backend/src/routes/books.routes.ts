import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, created, ok, paginated, parsePagination } from '../lib/http';
import { BadRequest, NotFound } from '../lib/errors';
import { authenticate, authorize } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { audit } from '../lib/audit';
import { BookProcessingJob, SourceBook } from '../models';
import { createBookRecord, enqueueBookProcessing } from '../services/books/ingest.service';

const router = Router();

router.use(authenticate, authorize('platform_admin', 'platform_owner'));

const hintsSchema = z.object({
  title: z.string().optional(),
  author: z.string().optional(),
  edition: z.string().optional(),
  publisher: z.string().optional(),
  year: z.coerce.number().optional(),
  level: z.enum(['L3', 'L4', 'L5', 'General', 'Professional', 'Other']).optional(),
  category: z.string().optional(),
  subject: z.string().optional(),
  moduleCode: z.string().optional(),
  language: z.string().optional(),
});

router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw BadRequest('No file uploaded');
    const hints = hintsSchema.parse(req.body ?? {});
    const { book, job } = await createBookRecord({
      originalname: req.file.originalname,
      buffer: req.file.buffer,
      size: req.file.size,
      uploadedBy: req.auth!.id,
      hints,
    });
    enqueueBookProcessing(String(job._id));
    await audit({ req, action: 'book.upload', entityType: 'SourceBook', entityId: String(book._id) });
    return created(res, { book, job });
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const filter: Record<string, unknown> = {};
    if (req.query.level) filter.level = req.query.level;
    if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([
      SourceBook.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SourceBook.countDocuments(filter),
    ]);
    return paginated(res, items, { page, limit, total });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const book = await SourceBook.findById(req.params.id).lean();
    if (!book) throw NotFound('Book not found');
    const job = await BookProcessingJob.findOne({ book: book._id }).sort({ createdAt: -1 }).lean();
    return ok(res, { book, job });
  }),
);

router.get(
  '/:id/job',
  asyncHandler(async (req, res) => {
    const job = await BookProcessingJob.findOne({ book: req.params.id }).sort({ createdAt: -1 }).lean();
    if (!job) throw NotFound('No processing job found');
    return ok(res, job);
  }),
);

router.post(
  '/:id/process',
  asyncHandler(async (req, res) => {
    const book = await SourceBook.findById(req.params.id);
    if (!book) throw NotFound('Book not found');
    const job = await BookProcessingJob.create({
      book: book._id,
      status: 'queued',
      requestedBy: req.auth!.id,
      steps: [
        { name: 'validate', status: 'pending' },
        { name: 'extract', status: 'pending' },
        { name: 'structure', status: 'pending' },
        { name: 'publish-draft', status: 'pending' },
      ],
    });
    enqueueBookProcessing(String(job._id));
    return created(res, job);
  }),
);

router.get(
  '/jobs/recent',
  asyncHandler(async (_req, res) => {
    const jobs = await BookProcessingJob.find().sort({ createdAt: -1 }).limit(50).populate('book', 'title level').lean();
    return ok(res, jobs);
  }),
);

router.post(
  '/:id/confirm-rights',
  asyncHandler(async (req, res) => {
    const book = await SourceBook.findById(req.params.id);
    if (!book) throw NotFound('Book not found');
    book.rights.copyrightConfirmed = true;
    book.rights.licenseNote = req.body?.licenseNote || book.rights.licenseNote;
    await book.save();
    await audit({ req, action: 'book.confirm_rights', entityType: 'SourceBook', entityId: String(book._id) });
    return ok(res, book);
  }),
);

export default router;
