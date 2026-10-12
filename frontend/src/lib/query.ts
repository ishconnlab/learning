import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      retry: (failureCount, error) => {
        const status = (error as { status?: number }).status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  me: ['me'] as const,
  notifications: ['notifications'] as const,
  cmsPages: ['cms', 'pages'] as const,
  cmsPage: (key: string) => ['cms', 'page', key] as const,
  courses: (filters?: Record<string, unknown>) => ['courses', filters ?? {}] as const,
  course: (id: string) => ['course', id] as const,
  courseCurriculum: (id: string) => ['course', id, 'curriculum'] as const,
  myEnrollments: ['enrollments', 'mine'] as const,
  enrollment: (id: string) => ['enrollments', id] as const,
  lesson: (lessonId: string) => ['lesson', lessonId] as const,
  assessment: (id: string) => ['assessments', id] as const,
  assignments: (query?: Record<string, unknown>) => ['assignments', query ?? {}] as const,
  assignment: (id: string) => ['assignments', id] as const,
  project: (courseId: string) => ['projects', 'course', courseId] as const,
  myProjects: () => ['projects', 'mine'] as const,
  certificates: () => ['certificates'] as const,
  books: (query?: Record<string, unknown>) => ['books', query] as const,
  users: (query?: Record<string, unknown>) => ['users', query] as const,
  platformReport: () => ['reports', 'platform'] as const,
  courseReport: (courseId: string) => ['reports', 'course', courseId] as const,
};
