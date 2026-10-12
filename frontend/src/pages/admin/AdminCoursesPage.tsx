import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Rocket, Undo2 } from 'lucide-react';
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
import { formatMoney } from '@/lib/utils';
import type { Course } from '@/types';

const LEVELS = ['L3', 'L4', 'L5', 'General', 'Professional', 'Other'];

export function AdminCoursesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', level: 'L3', category: 'Software Development', summary: '', description: '', price: '0' });

  const courses = useQuery({
    queryKey: queryKeys.courses({ scope: 'admin' }),
    queryFn: () => api.get<Course[]>('/courses', { query: { limit: 100 } }).then((r) => r.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.courses({ scope: 'admin' }) });

  const create = useMutation({
    mutationFn: () => api.post('/courses', { ...form, price: Number(form.price) || 0 }),
    onSuccess: () => {
      toast({ title: 'Course created', variant: 'success' });
      setForm({ title: '', level: 'L3', category: 'Software Development', summary: '', description: '', price: '0' });
      setShowForm(false);
      invalidate();
    },
    onError: (err) => toast({ title: 'Could not create', description: err instanceof ApiError ? err.message : undefined, variant: 'error' }),
  });

  const setPrice = useMutation({
    mutationFn: ({ id, price }: { id: string; price: number }) => api.patch(`/courses/${id}`, { price }),
    onSuccess: () => {
      toast({ title: 'Price updated', variant: 'success' });
      invalidate();
    },
    onError: (err) => toast({ title: 'Could not update price', description: err instanceof ApiError ? err.message : undefined, variant: 'error' }),
  });

  const publish = useMutation({
    mutationFn: (id: string) => api.post(`/courses/${id}/publish`),
    onSuccess: () => {
      toast({ title: 'Course published', variant: 'success' });
      invalidate();
    },
    onError: (err) => toast({ title: 'Could not publish', description: err instanceof ApiError ? err.message : undefined, variant: 'error' }),
  });

  const unpublish = useMutation({
    mutationFn: (id: string) => api.post(`/courses/${id}/unpublish`),
    onSuccess: () => {
      toast({ title: 'Course unpublished', variant: 'success' });
      invalidate();
    },
  });

  return (
    <div>
      <PageHeader
        title="Courses"
        title2-hidden
        description="Manage courses generated from source books."
        actions={
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            New course
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="level">Level</Label>
              <Select id="level" value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input id="category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="summary">Summary</Label>
              <Input id="summary" value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="price">Price (RWF)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step={1000}
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="0 = free"
              />
              <p className="mt-1 text-xs text-slate-400">0 = free. Paid courses start at 50,000 RWF.</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => create.mutate()} disabled={create.isPending || form.title.trim().length < 3}>
              {create.isPending ? 'Creating…' : 'Create course'}
            </Button>
          </div>
        </Card>
      )}

      {courses.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : (courses.data ?? []).length ? (
        <div className="space-y-2">
          {(courses.data ?? []).map((c) => (
            <Card key={c._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link to={`/app/courses/${c._id}`} className="font-medium text-slate-800 hover:text-brand-700">
                  {c.title}
                </Link>
                <p className="text-xs text-slate-400">
                  {c.level} · {c.category || 'Uncategorised'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={c.status === 'published' ? 'accent' : 'default'}>{c.status}</Badge>
                {c.price && c.price > 0 ? (
                  <>
                    <Badge variant="accent">{formatMoney(c.price)}</Badge>
                    <Button size="sm" variant="outline" onClick={() => setPrice.mutate({ id: c._id, price: 0 })} disabled={setPrice.isPending}>
                      Make free
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant="success">Free</Badge>
                    <Button size="sm" variant="outline" onClick={() => setPrice.mutate({ id: c._id, price: 50000 })} disabled={setPrice.isPending}>
                      Make paid
                    </Button>
                  </>
                )}
                {c.status === 'published' ? (
                  <Button size="sm" variant="outline" onClick={() => unpublish.mutate(c._id)} disabled={unpublish.isPending}>
                    <Undo2 className="h-4 w-4" />
                    Unpublish
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => publish.mutate(c._id)} disabled={publish.isPending}>
                    <Rocket className="h-4 w-4" />
                    Publish
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No courses" description="Create a course or ingest a book to generate one." />
      )}
    </div>
  );
}
