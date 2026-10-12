import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Trophy } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { newId } from '@/lib/offline/db';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea, Select } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Skeleton, EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils';
import type { Course, Enrollment, FinalProject, FinalProjectTask, ProjectSubmission } from '@/types';

type EnrollmentRow = Enrollment & { course: Course | null };

interface ProjectResponse {
  project: FinalProject;
  tasks: FinalProjectTask[];
}

export function ProjectsPage() {
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const courseId = params.get('courseId') || '';

  const enrollments = useQuery({
    queryKey: queryKeys.myEnrollments,
    queryFn: () => api.get<EnrollmentRow[]>('/enrollments/mine').then((r) => r.data),
  });

  const project = useQuery({
    queryKey: queryKeys.project(courseId),
    queryFn: () => api.get<ProjectResponse>(`/projects/course/${courseId}`).then((r) => r.data),
    enabled: Boolean(courseId),
    retry: false,
  });

  const courses = (enrollments.data ?? []).filter((e) => e.course);

  return (
    <div>
      <PageHeader
        title="Final project"
        description="Complete the three project tasks to demonstrate your competency."
        actions={
          courses.length ? (
            <Select value={courseId} onChange={(e) => setParams(e.target.value ? { courseId: e.target.value } : {})}>
              <option value="">Select a course…</option>
              {courses.map((c) => (
                <option key={c.course?._id} value={c.course?._id}>
                  {c.course?.title}
                </option>
              ))}
            </Select>
          ) : undefined
        }
      />

      {!courseId ? (
        <EmptyState
          icon={<FolderKanban className="h-8 w-8" />}
          title="Select a course"
          description="Choose one of your enrolled courses to view its final project."
        />
      ) : project.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-40" />
        </div>
      ) : project.isError || !project.data ? (
        <Alert variant="info">This course does not have a published final project yet.</Alert>
      ) : (
        <div className="space-y-5">
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-brand-600" />
              <h2 className="text-lg font-semibold text-slate-900">{project.data.project.title}</h2>
            </div>
            <p className="mt-2 text-sm text-slate-600">{project.data.project.description}</p>
          </Card>
          {project.data.tasks.map((task) => (
            <ProjectTaskCard key={task._id} task={task} onChanged={() => queryClient.invalidateQueries({ queryKey: queryKeys.project(courseId) })} toast={toast} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectTaskCard({
  task,
  onChanged,
  toast,
}: {
  task: FinalProjectTask;
  onChanged: () => void;
  toast: (input: { title: string; description?: string; variant?: 'info' | 'success' | 'warning' | 'error' }) => void;
}) {
  const submission = task.mySubmission;
  const [content, setContent] = useState('');
  const [clientId] = useState(() => newId());

  const submissionStatus = (s: ProjectSubmission | null | undefined) => {
    if (!s) return 'not started';
    return s.status;
  };

  const save = useMutation({
    mutationFn: (submitNow: boolean) =>
      api.post(`/projects/tasks/${task._id}/submissions`, {
        clientSubmissionId: clientId,
        content,
        submit: submitNow,
      }),
    onSuccess: (_r, submitNow) => {
      toast({ title: submitNow ? 'Task submitted' : 'Draft saved', variant: 'success' });
      onChanged();
    },
    onError: (err) => toast({ title: 'Could not save', description: err instanceof ApiError ? err.message : undefined, variant: 'error' }),
  });

  const current = submissionStatus(submission);
  const done = ['submitted', 'late', 'graded', 'returned'].includes(current);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="brand">Task {task.order}</Badge>
            <Badge variant="outline" className="capitalize">{task.kind}</Badge>
          </div>
          <h3 className="mt-2 font-semibold text-slate-900">{task.title}</h3>
          {task.deadline && <p className="text-xs text-slate-400">Due {formatDate(task.deadline)}</p>}
        </div>
        <Badge variant={done ? 'accent' : 'default'}>{current.replace(/_/g, ' ')}</Badge>
      </div>

      {task.instructions && <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{task.instructions}</p>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {task.deliverables?.length ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Deliverables</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {task.deliverables.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {task.acceptanceCriteria?.length ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Acceptance criteria</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {task.acceptanceCriteria.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {submission?.grade != null && (
        <Alert variant="success" className="mt-4" title={`Graded: ${submission.grade} / ${task.marks}`}>
          {submission.feedback || 'No feedback provided.'}
        </Alert>
      )}

      {!done && (
        <div className="mt-4">
          <Textarea
            value={content || submission?.content || ''}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Describe your work or paste a link…"
          />
          <div className="mt-3 flex gap-2">
            <Button onClick={() => save.mutate(true)} disabled={save.isPending}>
              {save.isPending ? 'Submitting…' : 'Submit task'}
            </Button>
            <Button variant="outline" onClick={() => save.mutate(false)} disabled={save.isPending}>
              Save draft
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
