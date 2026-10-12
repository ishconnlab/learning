import { Router } from 'express';
import authRoutes from './auth.routes';
import usersRoutes from './users.routes';
import schoolsRoutes from './schools.routes';
import booksRoutes from './books.routes';
import coursesRoutes from './courses.routes';
import enrollmentsRoutes from './enrollments.routes';
import learningRoutes from './learning.routes';
import assessmentsRoutes from './assessments.routes';
import assignmentsRoutes from './assignments.routes';
import projectsRoutes from './projects.routes';
import certificatesRoutes from './certificates.routes';
import cmsRoutes from './cms.routes';
import syncRoutes from './sync.routes';
import filesRoutes from './files.routes';
import reportsRoutes from './reports.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/schools', schoolsRoutes);
router.use('/books', booksRoutes);
router.use('/courses', coursesRoutes);
router.use('/enrollments', enrollmentsRoutes);
router.use('/learning', learningRoutes);
router.use('/assessments', assessmentsRoutes);
router.use('/assignments', assignmentsRoutes);
router.use('/projects', projectsRoutes);
router.use('/certificates', certificatesRoutes);
router.use('/cms', cmsRoutes);
router.use('/sync', syncRoutes);
router.use('/files', filesRoutes);
router.use('/reports', reportsRoutes);

export default router;
