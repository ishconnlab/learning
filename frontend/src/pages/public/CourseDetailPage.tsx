import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronDown, Clock, GraduationCap, Layers, ListChecks } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { useAuth } from '@/store/auth';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { Course, Module } from '@/types';

interface DetailResponse {
  course: Course;
  moduleCount: number;
}

export function CourseDetailPage() {
  const { idOrSlug = '' } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [openModule, setOpenModule] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: queryKeys.course(idOrSlug),
    queryFn: () => api.get<DetailResponse>(`/courses/${idOrSlug}`).then((r) => r.data),
  });

  const curriculum = useQuery({
    queryKey: queryKeys.courseCurriculum(idOrSlug),
    queryFn: () => api.get<Module[]>(`/courses/${idOrSlug}/modules`).then((r) => r.data),
    enabled: Boolean(detail.data),
  });

  const enroll = useMutation({
    mutationFn: (courseId: string) => api.post('/enrollments', { courseId }),
    onSuccess: () => {
      toast({ title: 'Enrolled', description: 'You can now start learning.', variant: 'success' });
      navigate('/app/courses');
    },
    onError: (err) => toast({ title: 'Could not enroll', description: err instanceof ApiError ? err.message : 'Please try again.', variant: 'error' }),
  });

  const course = detail.data?.course;

  if (detail.isLoading) {
    return (
      <div className="container-page py-12">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-5/6" />
        <Skeleton className="mt-8 h-40 w-full" />
      </div>
    );
  }

  if (detail.isError || !course) {
    return (
      <div className="container-page py-20 text-center">
        <p className="text-lg font-semibold text-slate-700">Course not found</p>
        <Link to="/courses" className="link-brand mt-2 inline-block text-sm">
          ← Back to catalog
        </Link>
      </div>
    );
  }

  const modules = curriculum.data ?? [];

  const handleEnroll = () => {
    if (!user) {
      navigate(`/login?next=/courses/${course.slug || course._id}`);
      return;
    }
    enroll.mutate(course._id);
  };

  return (
    <div className="container-page py-12">
      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brand">{course.level}</Badge>
            {course.category && <Badge variant="default">{course.category}</Badge>}
            {course.status !== 'published' && <Badge variant="outline">Draft preview</Badge>}
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{course.title}</h1>
          {(course.summary || course.description) && (
            <p className="mt-4 max-w-2xl text-slate-600">{course.summary || course.description}</p>
          )}

          <div className="mt-6 flex flex-wrap gap-5 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-brand-500" />
              {detail.data?.moduleCount ?? modules.length} modules
            </span>
            {course.estimatedHours != null && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-brand-500" />
                ~{course.estimatedHours} hours
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4 text-brand-500" />
              Certificate eligible
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ListChecks className="h-4 w-4 text-brand-500" />
              Assessments &amp; final project
            </span>
          </div>

          {course.description && course.summary && (
            <Card className="mt-8 p-6">
              <h2 className="text-lg font-semibold text-slate-900">About this course</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{course.description}</p>
            </Card>
          )}

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900">Curriculum</h2>
            {curriculum.isLoading ? (
              <div className="mt-4 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : modules.length ? (
              <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200">
                {modules.map((mod, idx) => {
                  const isOpen = openModule === mod._id;
                  return (
                    <div key={mod._id} className="bg-white">
                      <button
                        type="button"
                        onClick={() => setOpenModule(isOpen ? null : mod._id)}
                        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                            {idx + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-800">{mod.title}</span>
                            <span className="text-xs text-slate-400">{mod.lessons?.length ?? 0} lessons</span>
                          </span>
                        </span>
                        <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
                      </button>
                      {isOpen && (
                        <div className="space-y-1 border-t border-slate-100 px-5 py-3">
                          {(mod.lessons ?? []).map((lesson) => (
                            <div key={lesson._id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm">
                              <span className="min-w-0 truncate text-slate-600">{lesson.title}</span>
                              <Badge variant="outline" className="capitalize">
                                {lesson.kind.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                          ))}
                          {(mod.practicalActivities ?? []).map((act) => (
                            <div key={act._id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm">
                              <span className="min-w-0 truncate text-slate-600">{act.title}</span>
                              <Badge variant="accent">Practical</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">The curriculum is being prepared.</p>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6">
            <p className="text-sm text-slate-500">Free enrollment</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">Free</p>
            <Button size="lg" className="mt-5 w-full" onClick={handleEnroll} disabled={enroll.isPending}>
              {enroll.isPending ? 'Enrolling…' : user ? 'Enroll now' : 'Sign in to enroll'}
            </Button>
            <ul className="mt-6 space-y-2 text-sm text-slate-600">
              <li>✓ Learn online or offline</li>
              <li>• Practice activities per module</li>
              <li>• Module assessments</li>
              <li>• Three-part final project</li>
              <li>• Verifiable certificate</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
