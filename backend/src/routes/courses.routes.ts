import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, created, ok, paginated, parsePagination } from '../lib/http';
import { BadRequest, NotFound } from '../lib/errors';
import { isPlatformAdmin, optionalAuth, authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { audit } from '../lib/audit';
import { Assessment, Course, CourseVersion, Lesson, Module, PracticalActivity, Question, SourceBook } from '../models';
import { slugify } from '../lib/ids';

const router = Router();

async function findCourse(idOrSlug: string) {
  const course = await Course.findOne({
    $or: [{ slug: idOrSlug }, ...(idOrSlug.match(/^[a-f\d]{24}$/i) ? [{ _id: idOrSlug }] : [])],
  });
  return course;
}

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const staff = req.auth && (isPlatformAdmin(req.auth.role) || req.auth.role === 'teacher');
    const filter: Record<string, unknown> = {};
    if (req.query.level) filter.level = req.query.level;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.featured === 'true') filter.featured = true;
    if (!staff) filter.status = 'published';
    if (req.query.q) filter.$text = { $search: String(req.query.q) };

    const [items, total] = await Promise.all([
      Course.find(filter).sort({ featured: -1, publishedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Course.countDocuments(filter),
    ]);
    return paginated(res, items, { page, limit, total });
  }),
);

router.get(
  '/meta/filters',
  asyncHandler(async (_req, res) => {
    const [levels, categories] = await Promise.all([
      Course.distinct('level', { status: 'published' }),
      Course.distinct('category', { status: 'published' }),
    ]);
    return ok(res, { levels, categories });
  }),
);

router.get(
  '/:idOrSlug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const course = await findCourse(String(req.params.idOrSlug));
    if (!course) throw NotFound('Course not found');
    const staff = req.auth && (isPlatformAdmin(req.auth.role) || req.auth.role === 'teacher');
    if (course.status !== 'published' && !staff) throw NotFound('Course not found');
    // Public preview must never leak the source book key.
    const moduleCount = await Module.countDocuments({ course: course._id });
    return ok(res, { course: { ...course.toJSON(), _id: String(course._id) }, moduleCount });
  }),
);

router.get(
  '/:idOrSlug/modules',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const course = await findCourse(String(req.params.idOrSlug));
    if (!course) throw NotFound('Course not found');
    const staff = req.auth && (isPlatformAdmin(req.auth.role) || req.auth.role === 'teacher');
    if (course.status !== 'published' && !staff) throw NotFound('Course not found');
    const statusFilter = staff ? {} : { status: 'published' };

    const modules = await Module.find({ course: course._id, ...statusFilter }).sort({ order: 1 }).lean();
    const [lessons, activities] = await Promise.all([
      Lesson.find({ course: course._id, module: { $in: modules.map((m) => m._id) }, ...statusFilter })
        .select('module order kind title estimatedMinutes sourceRef status')
        .sort({ order: 1 })
        .lean(),
      PracticalActivity.find({ course: course._id, module: { $in: modules.map((m) => m._id) }, ...statusFilter })
        .select('module title kind difficulty marks estimatedMinutes requiresSubmission')
        .lean(),
    ]);

    return ok(
      res,
      modules.map((m) => ({
        ...m,
        lessons: lessons.filter((l) => String(l.module) === String(m._id)),
        practicalActivities: activities.filter((a) => String(a.module) === String(m._id)),
      })),
    );
  }),
);

router.get(
  '/:idOrSlug/admin',
  authenticate,
  authorize('platform_admin', 'platform_owner'),
  asyncHandler(async (req, res) => {
    const course = await findCourse(String(req.params.idOrSlug));
    if (!course) throw NotFound('Course not found');
    const [modules, lessons, activities, questions, assessments, sourceBook, versions] = await Promise.all([
      Module.find({ course: course._id }).sort({ order: 1 }).lean(),
      Lesson.find({ course: course._id }).sort({ order: 1 }).lean(),
      PracticalActivity.find({ course: course._id }).lean(),
      Question.find({ course: course._id }).lean(),
      Assessment.find({ course: course._id }).lean(),
      course.sourceBook ? SourceBook.findById(course.sourceBook).lean() : null,
      CourseVersion.find({ course: course._id }).sort({ version: -1 }).lean(),
    ]);
    return ok(res, { course, modules, lessons, activities, questions, assessments, sourceBook, versions });
  }),
);

const courseSchema = z.object({
  title: z.string().min(3),
  summary: z.string().optional(),
  description: z.string().optional(),
  level: z.enum(['L3', 'L4', 'L5', 'General', 'Professional', 'Other']),
  category: z.string().default('Software Development'),
  subject: z.string().optional(),
  language: z.string().optional(),
  code: z.string().optional(),
  featured: z.boolean().optional(),
  price: z
    .number()
    .int()
    .min(0)
    .refine((v) => v === 0 || v >= 50000, { message: 'Paid courses must cost at least 50,000 RWF' })
    .optional(),
  tags: z.array(z.string()).optional(),
  estimatedHours: z.number().optional(),
});

router.post(
  '/',
  authenticate,
  authorize('platform_admin', 'platform_owner'),
  validate(courseSchema),
  asyncHandler(async (req, res) => {
    const course = await Course.create({
      ...req.body,
      slug: slugify(req.body.title),
      code: req.body.code || `CRS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      status: 'draft',
      createdBy: req.auth!.id,
    });
    await audit({ req, action: 'course.create', entityType: 'Course', entityId: String(course._id) });
    return created(res, course);
  }),
);

router.patch(
  '/:id',
  authenticate,
  authorize('platform_admin', 'platform_owner'),
  asyncHandler(async (req, res) => {
    const course = await Course.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!course) throw NotFound('Course not found');
    await audit({ req, action: 'course.update', entityType: 'Course', entityId: String(course._id) });
    return ok(res, course);
  }),
);

router.post(
  '/:id/publish',
  authenticate,
  authorize('platform_admin', 'platform_owner'),
  asyncHandler(async (req, res) => {
    const course = await Course.findById(req.params.id);
    if (!course) throw NotFound('Course not found');
    const modules = await Module.find({ course: course._id }).sort({ order: 1 }).lean();
    if (!modules.length) throw BadRequest('Cannot publish a course with no modules');

    await Module.updateMany({ course: course._id }, { $set: { status: 'published' } });
    await Lesson.updateMany({ course: course._id }, { $set: { status: 'published' } });
    await PracticalActivity.updateMany({ course: course._id }, { $set: { status: 'published' } });

    let version = course.activeVersion ? await CourseVersion.findById(course.activeVersion) : null;
    if (!version) {
      version = await CourseVersion.create({
        course: course._id,
        version: 1,
        status: 'published',
        sourceBook: course.sourceBook,
        modules: modules.map((m) => m._id),
        createdBy: req.auth!.id,
      });
    }
    version.status = 'published';
    version.publishedAt = new Date();
    version.modules = modules.map((m) => m._id);
    await version.save();

    course.status = 'published';
    course.activeVersion = version._id;
    course.publishedAt = new Date();
    await course.save();
    await audit({ req, action: 'course.publish', entityType: 'Course', entityId: String(course._id) });
    return ok(res, course);
  }),
);

router.post(
  '/:id/unpublish',
  authenticate,
  authorize('platform_admin', 'platform_owner'),
  asyncHandler(async (req, res) => {
    const course = await Course.findByIdAndUpdate(req.params.id, { $set: { status: 'draft' } }, { new: true });
    if (!course) throw NotFound('Course not found');
    await audit({ req, action: 'course.unpublish', entityType: 'Course', entityId: String(course._id) });
    return ok(res, course);
  }),
);

export default router;
