import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, FilePlus2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton, EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils';
import type { Assignment, Course } from '@/types';

export function TeachingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ courseId: '', title: '', instructions: '', dueAt: '', marks: '', allowLate: false });

  const courses = useQuery({
    queryKey: queryKeys.courses({ scope: 'teaching' }),
    queryFn: () => api.get<Course[]>('/courses', { query: { limit: 100 } }).then((r) => r.data),
  });

  const assignments = useQuery({
    queryKey: queryKeys.assignments({ scope: 'teaching' }),
    queryFn: () => api.get<Assignment[]>('/assignments').then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post('/assignments', {
        courseId: form.courseId,
        title: form.title,
        instructions: form.instructions || undefined,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
        marks: form.marks ? Number(form.marks) : undefined,
        allowLate: form.allowLate,
      }),
    onSuccess: () => {
      toast({ title: 'Assignment created', description: 'It is saved as a draft — publish it when ready.', variant: 'success' });
      setForm({ courseId: '', title: '', instructions: '', dueAt: '', marks: '', allowLate: false });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments({ scope: 'teaching' }) });
    },
    onError: (err) => toast({ title: 'Could not create', description: err instanceof ApiError ? err.message : undefined, variant: 'error' }),
  });

  return (
    <div>
      <PageHeader
        title="Teaching"
        description="Create assignments and review your courses."
        actions={
          <Button onClick={() => setShowForm((v) => !v)}>
            <FilePlus2 className="h-4 w-4" />
            New assignment
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Create assignment</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="course">Course</Label>
              <Select id="course" value={form.courseId} onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}>
                <option value="">Select a course…</option>
                {(courses.data ?? []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea id="instructions" value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="due">Due date</Label>
              <Input id="due" type="datetime-local" value={form.dueAt} onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="marks">Marks</Label>
              <Input id="marks" type="number" min={1} value={form.marks} onChange={(e) => setForm((f) => ({ ...f, marks: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.allowLate}
                onChange={(e) => setForm((f) => ({ ...f, allowLate: e.target.checked }))}
                className="h-4 w-4 accent-brand-600"
              />
              Allow late submissions
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.courseId || form.title.trim().length < 3}>
              {create.isPending ? 'Creating…' : 'Create assignment'}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Courses</h2>
          {courses.isLoading ? (
            <Skeleton className="h-64" />
          ) : (courses.data ?? []).length ? (
            <div className="space-y-2">
              {(courses.data ?? []).map((c) => (
                <Card key={c._id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{c.title}</p>
                    <p className="text-xs text-slate-400">
                      {c.level} · {c.status}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/app/courses/${c._id}`}>
                      <BarChart3 className="h-4 w-4" />
                      Open
                    </Link>
                  </Button>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState title="No courses" description="No courses are available yet." />
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Assignments</h2>
          {assignments.isLoading ? (
            <Skeleton className="h-64" />
          ) : (assignments.data ?? []).length ? (
            <div className="space-y-2">
              {(assignments.data ?? []).map((a) => (
                <Card key={a._id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link to={`/app/assignments/${a._id}`} className="truncate font-medium text-slate-800 hover:text-brand-700">
                      {a.title}
                    </Link>
                    <p className="text-xs text-slate-400">{a.dueAt ? `Due ${formatDate(a.dueAt)}` : 'No deadline'}</p>
                  </div>
                  <Badge variant={a.status === 'published' ? 'accent' : 'default'}>{a.status}</Badge>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState title="No assignments" description="Create an assignment to get started." />
          )}
        </div>
      </div>
    </div>
  );
}
