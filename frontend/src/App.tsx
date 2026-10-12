import { Route, Routes } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LandingPage } from '@/pages/public/LandingPage';
import { CoursesPage } from '@/pages/public/CoursesPage';
import { CourseDetailPage } from '@/pages/public/CourseDetailPage';
import { VerifyCertificatePage } from '@/pages/public/VerifyCertificatePage';
import { CmsPageView } from '@/pages/public/CmsPageView';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { DashboardPage } from '@/pages/app/DashboardPage';
import { CatalogPage } from '@/pages/app/CatalogPage';
import { MyCoursesPage } from '@/pages/app/MyCoursesPage';
import { CoursePlayerPage } from '@/pages/app/CoursePlayerPage';
import { AssessmentPage } from '@/pages/app/AssessmentPage';
import { AssignmentsPage } from '@/pages/app/AssignmentsPage';
import { AssignmentDetailPage } from '@/pages/app/AssignmentDetailPage';
import { ProjectsPage } from '@/pages/app/ProjectsPage';
import { CertificatesPage } from '@/pages/app/CertificatesPage';
import { DownloadsPage } from '@/pages/app/DownloadsPage';
import { ProfilePage } from '@/pages/app/ProfilePage';
import { TeachingPage } from '@/pages/app/TeachingPage';
import { AdminBooksPage } from '@/pages/admin/AdminBooksPage';
import { AdminCoursesPage } from '@/pages/admin/AdminCoursesPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminSchoolsPage } from '@/pages/admin/AdminSchoolsPage';
import { AdminReportsPage } from '@/pages/admin/AdminReportsPage';
import { AdminCmsPage } from '@/pages/admin/AdminCmsPage';

export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/courses/:idOrSlug" element={<CourseDetailPage />} />
        <Route path="/verify" element={<VerifyCertificatePage />} />
        <Route path="/verify/:certificateId" element={<VerifyCertificatePage />} />
        <Route path="/about" element={<CmsPageView pageKey="about" />} />
        <Route path="/contact" element={<CmsPageView pageKey="contact" />} />
        <Route path="/privacy" element={<CmsPageView pageKey="privacy" />} />
        <Route path="/terms" element={<CmsPageView pageKey="terms" />} />
      </Route>

      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/app" element={<DashboardPage />} />
          <Route path="/app/catalog" element={<CatalogPage />} />
          <Route path="/app/courses" element={<MyCoursesPage />} />
          <Route path="/app/courses/:courseId" element={<CoursePlayerPage />} />
          <Route path="/app/quiz/:assessmentId" element={<AssessmentPage />} />
          <Route path="/app/assignments" element={<AssignmentsPage />} />
          <Route path="/app/assignments/:id" element={<AssignmentDetailPage />} />
          <Route path="/app/projects" element={<ProjectsPage />} />
          <Route path="/app/certificates" element={<CertificatesPage />} />
          <Route path="/app/downloads" element={<DownloadsPage />} />
          <Route path="/app/profile" element={<ProfilePage />} />

          <Route element={<ProtectedRoute roles={['teacher', 'platform_admin', 'platform_owner']} />}>
            <Route path="/app/teaching" element={<TeachingPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['platform_admin', 'platform_owner']} />}>
            <Route path="/app/admin/books" element={<AdminBooksPage />} />
            <Route path="/app/admin/courses" element={<AdminCoursesPage />} />
            <Route path="/app/admin/users" element={<AdminUsersPage />} />
            <Route path="/app/admin/schools" element={<AdminSchoolsPage />} />
            <Route path="/app/admin/cms" element={<AdminCmsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['platform_admin', 'platform_owner', 'school_admin']} />}>
            <Route path="/app/admin/reports" element={<AdminReportsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <p className="mt-2 text-lg font-semibold text-slate-800">Page not found</p>
      <p className="mt-1 text-sm text-slate-500">The page you are looking for does not exist.</p>
      <a href="/" className="link-brand mt-6 text-sm font-semibold">
        ← Back to home
      </a>
    </div>
  );
}
