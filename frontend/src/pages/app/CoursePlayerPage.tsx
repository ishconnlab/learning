import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronRight, Circle, ClipboardList, FileQuestion, PlayCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { db } from '@/lib/offline/db';
import { useToast } from '@/components/ui/toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/empty-state';
import { LessonContent } from '@/components/LessonContent';
import { Alert } from '@/components/ui/alert';
import { cn, percent } from '@/lib/utils';
import type { AssessmentSummary, CourseProgress, Enrollment, Lesson, Module, PracticalActivity } from '@/types';

interface ModuleDetail {
  module: Module;
  lessons: Lesson[];
  activities: PracticalActivity[];
  assessment: AssessmentSummary | null;
}

export function CoursePlayerPage() {
  const { courseId = '' } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const curriculum = useQuery({
    queryKey: queryKeys.courseCurriculum(courseId),
    queryFn: () => api.get<Module[]>(`/courses/${courseId}/modules`).then((r) => r.data),
  });

  const enrollments = useQuery({
    queryKey: queryKeys.myEnrollments,
    queryFn: () => api.get<Enrollment[]>('/enrollments/mine').then((r) => r.data),
  });

  const modules = useMemo(() => curriculum.data ?? [], [curriculum.data]);

  const enrollment = useMemo(
    () => (enrollments.data ?? []).find((e) => String(typeof e.course === 'string' ? e.course : e.course?._id) === courseId),
    [enrollments.data, courseId],
  );

  const progress = useQuery({
    queryKey: ['progress', enrollment?._id],
    queryFn: () => api.get<CourseProgress>(`/enrollments/${enrollment!._id}/progress`).then((r) => r.data),
    enabled: Boolean(enrollment?._id),
  });

  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeModuleId && modules.length) {
      setActiveModuleId(modules[0]._id);
      setActiveLessonId(modules[0].lessons?.[0]?._id ?? null);
    }
  }, [modules, activeModuleId]);

  const moduleDetail = useQuery({
    queryKey: ['learning', 'module', activeModuleId],
    queryFn: () => api.get<ModuleDetail>(`/learning/modules/${activeModuleId}`).then((r) => r.data),
    enabled: Boolean(activeModuleId),
  });

  const lesson = useQuery({
    queryKey: queryKeys.lesson(activeLessonId ?? ''),
    queryFn: async () => {
      try {
        return await api.get<Lesson>(`/learning/lessons/${activeLessonId}`).then((r) => r.data);
      } catch {
        const cached = activeLessonId ? await db.lessons.get(activeLessonId) : undefined;
        if (cached) return cached.lesson;
        throw new Error('offline');
      }
    },
    enabled: Boolean(activeLessonId),
  });

  const markRead = useMutation({
    mutationFn: (lessonId: string) => api.post(`/learning/lessons/${lessonId}/read`),
    onSuccess: () => {
      toast({ title: 'Marked as read', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['progress', enrollment?._id] });
    },
  });

  const completeActivity = useMutation({
    mutationFn: (activityId: string) => api.post(`/learning/activities/${activityId}/complete`),
    onSuccess: () => {
      toast({ title: 'Activity completed', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['progress', enrollment?._id] });
    },
  });

  const activeModule = modules.find((m) => m._id === activeModuleId);
  const completion = progress.data?.completionPercent ?? 0;
  const moduleProgress = progress.data?.modules?.find((m) => m.module === activeModuleId);
  const readLessons = new Set(moduleProgress?.lessonsRead ?? []);
  const doneActivities = new Set(moduleProgress?.practicalCompleted ?? []);

  if (enrollments.isLoading || (!modules.length && progress.isLoading)) {
    return (
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-4">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Course progress</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{percent(completion)}</p>
          <Progress value={completion} className="mt-2" />
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-700">Modules</p>
          </div>
          <nav className="max-h-[60vh] overflow-y-auto p-2">
            {modules.map((mod, idx) => (
              <div key={mod._id} className="mb-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModuleId(mod._id);
                    setActiveLessonId(mod.lessons?.[0]?._id ?? null);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium',
                    activeModuleId === mod._id ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                    {idx + 1}
                  </span>
                  <span className="truncate">{mod.title}</span>
                </button>
                {activeModuleId === mod._id && (
                  <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-200 pl-2">
                    {(mod.lessons ?? []).map((lesson) => (
                      <button
                        key={lesson._id}
                        type="button"
                        onClick={() => setActiveLessonId(lesson._id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs',
                          activeLessonId === lesson._id ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100',
                        )}
                      >
                        {readLessons.has(lesson._id) ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent-500" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 shrink-0 opacity-40" />
                        )}
                        <span className="truncate">{lesson.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </Card>
      </aside>

      <main className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs text-slate-400">{activeModule?.title}</p>
            <h1 className="text-xl font-bold text-slate-900">{lesson.data?.title || 'Select a lesson'}</h1>
          </div>
          {activeLessonId && (
            <Button
              variant={activeLessonId && readLessons.has(activeLessonId) ? 'subtle' : 'primary'}
              disabled={markRead.isPending || (activeLessonId ? readLessons.has(activeLessonId) : false)}
              onClick={() => activeLessonId && markRead.mutate(activeLessonId)}
            >
              <CheckCircle2 className="h-4 w-4" />
              {activeLessonId && readLessons.has(activeLessonId) ? 'Read' : 'Mark as read'}
            </Button>
          )}
        </div>

        {lesson.isLoading ? (
          <Card className="p-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-3 h-4 w-5/6" />
            <Skeleton className="mt-3 h-4 w-2/3" />
          </Card>
        ) : lesson.isError ? (
          <Alert variant="warning">This lesson is not available offline. Reconnect to load it.</Alert>
        ) : lesson.data ? (
          <Card className="p-6">
            <LessonContent lesson={lesson.data} />
          </Card>
        ) : (
          <Alert variant="info">Choose a lesson from the list to begin.</Alert>
        )}

        {(moduleDetail.data?.activities ?? []).length > 0 && (
          <div className="mt-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              <ClipboardList className="h-4 w-4" />
              Practical activities
            </h2>
            <div className="space-y-3">
              {(moduleDetail.data?.activities ?? []).map((activity) => (
                <Card key={activity._id} className="flex items-start justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{activity.title}</p>
                    {activity.instructions && <p className="mt-1 text-sm text-slate-500">{activity.instructions}</p>}
                  </div>
                  {doneActivities.has(activity._id) ? (
                    <Badge variant="accent" className="shrink-0">Done</Badge>
                  ) : (
                    <Button size="sm" variant="outline" className="shrink-0" disabled={completeActivity.isPending} onClick={() => completeActivity.mutate(activity._id)}>
                      Mark complete
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {moduleDetail.data?.assessment && (
          <Card className="mt-6 flex items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <FileQuestion className="h-6 w-6 text-brand-600" />
              <div>
                <p className="font-medium text-slate-800">{moduleDetail.data.assessment.title}</p>
                <p className="text-xs text-slate-400">
                  {moduleDetail.data.assessment.attemptsRemaining} attempts remaining · {passMarkLabel(moduleDetail.data.assessment)}
                </p>
              </div>
            </div>
            {activeModuleId && (
              <Button asChild className="shrink-0">
                <Link to={`/app/quiz/${moduleDetail.data.assessment.id}`}>
                  <PlayCircle className="h-4 w-4" />
                  Start
                </Link>
              </Button>
            )}
          </Card>
        )}

        <div className="mt-6 flex justify-end">
          <Link to="/app/courses" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
            All my courses
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}

function passMarkLabel(a: AssessmentSummary): string {
  return `pass mark ${a.passMarkPercent}%`;
}
