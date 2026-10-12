import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HardDriveDownload, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { cacheCourse, listDownloadedCourses, removeCachedCourse, type CachedCourse } from '@/lib/offline/db';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDateTime } from '@/lib/utils';
import type { Course, Enrollment, Lesson, Module } from '@/types';

type EnrollmentRow = Enrollment & { course: Course | null };

export function DownloadsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cached, setCached] = useState<CachedCourse[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const enrollments = useQuery({
    queryKey: queryKeys.myEnrollments,
    queryFn: () => api.get<EnrollmentRow[]>('/enrollments/mine').then((r) => r.data),
  });

  const refresh = useCallback(async () => {
    setCached(await listDownloadedCourses());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const download = async (courseId: string) => {
    setBusy(courseId);
    try {
      const detail = await api.get<{ course: Course }>(`/courses/${courseId}`).then((r) => r.data);
      const modules = await api.get<Module[]>(`/courses/${courseId}/modules`).then((r) => r.data);

      const hydrated: Module[] = [];
      const activities = [];
      for (const mod of modules) {
        const fullLessons: Lesson[] = [];
        for (const lesson of mod.lessons ?? []) {
          const full = await api.get<Lesson>(`/learning/lessons/${lesson._id}`).then((r) => r.data).catch(() => lesson);
          fullLessons.push(full);
        }
        hydrated.push({ ...mod, lessons: fullLessons });
        activities.push(...(mod.practicalActivities ?? []));
      }

      await cacheCourse({
        id: courseId,
        course: detail.course,
        modules: hydrated,
        activities,
        downloadedAt: Date.now(),
      });
      await refresh();
      toast({ title: 'Downloaded', description: 'This course is now available offline.', variant: 'success' });
    } catch {
      toast({ title: 'Download failed', description: 'Please check your connection and try again.', variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (courseId: string) => {
    await removeCachedCourse(courseId);
    await refresh();
    queryClient.invalidateQueries();
  };

  const cachedIds = new Set(cached.map((c) => c.id));
  const courses = (enrollments.data ?? []).filter((e) => e.course);

  return (
    <div>
      <PageHeader
        title="Offline downloads"
        description="Download courses to study without an internet connection. Progress syncs automatically when you are back online."
      />

      {cached.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Downloaded</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {cached.map((c) => (
              <Card key={c.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{c.course.title}</p>
                  <p className="text-xs text-slate-400">Saved {formatDateTime(new Date(c.downloadedAt))}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="accent">Offline ready</Badge>
                  <Button size="icon" variant="ghost" onClick={() => void remove(c.id)} aria-label="Remove download">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Your courses</h2>
      {enrollments.isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : courses.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {courses.map((en) => {
            const courseId = en.course?._id ?? '';
            const title = en.course?.title ?? 'Course';
            return (
              <Card key={en._id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link to={`/app/courses/${courseId}`} className="block truncate font-medium text-slate-800 hover:text-brand-700">
                    {title}
                  </Link>
                  <p className="text-xs capitalize text-slate-400">{en.status}</p>
                </div>
                {cachedIds.has(courseId) ? (
                  <Badge variant="accent" className="shrink-0">Downloaded</Badge>
                ) : (
                  <Button size="sm" variant="outline" disabled={busy === courseId} onClick={() => void download(courseId)}>
                    <HardDriveDownload className="h-4 w-4" />
                    {busy === courseId ? 'Saving…' : 'Download'}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<HardDriveDownload className="h-8 w-8" />}
          title="Nothing to download yet"
          description="Enroll in a course to make it available offline."
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
