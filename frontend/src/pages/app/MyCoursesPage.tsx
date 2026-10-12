import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton, EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils';
import type { Course, Enrollment } from '@/types';

type EnrollmentRow = Enrollment & { course: Course | null };

export function MyCoursesPage() {
  const query = useQuery({
    queryKey: queryKeys.myEnrollments,
    queryFn: () => api.get<EnrollmentRow[]>('/enrollments/mine').then((r) => r.data),
  });

  const items = query.data ?? [];

  return (
    <div>
      <PageHeader
        title="My learning"
        description="All the courses you are enrolled in."
        actions={
          <Button asChild variant="outline">
            <Link to="/app/catalog">
              <BookOpen className="h-4 w-4" />
              Browse catalog
            </Link>
          </Button>
        }
      />

      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((en) => {
            const course = en.course;
            return (
              <Card key={en._id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">{course?.title || 'Course'}</p>
                    <p className="mt-0.5 text-xs text-slate-400">Enrolled {formatDate(en.enrolledAt)}</p>
                  </div>
                  <Badge variant={en.status === 'completed' ? 'accent' : en.status === 'active' ? 'brand' : 'default'}>
                    {en.status}
                  </Badge>
                </div>
                <div className="mt-auto pt-4">
                  <Button asChild size="sm" className="w-full">
                    <Link to={`/app/courses/${course?._id || ''}`}>
                      {en.status === 'completed' ? 'Review course' : 'Continue learning'}
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<BookOpen className="h-8 w-8" />}
          title="You are not enrolled in any course yet"
          description="Browse the catalog and enroll in a course to get started."
          action={
            <Button asChild>
              <Link to="/app/catalog">Browse catalog</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
