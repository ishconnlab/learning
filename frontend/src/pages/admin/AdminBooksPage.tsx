import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookUp, RefreshCw, Upload } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton, EmptyState } from '@/components/ui/empty-state';
import { formatDateTime } from '@/lib/utils';
import type { BookJob, SourceBook } from '@/types';

const LEVELS = ['L3', 'L4', 'L5', 'General', 'Professional', 'Other'];

export function AdminBooksPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [hints, setHints] = useState({ title: '', level: 'L3', category: '', author: '' });

  const books = useQuery({
    queryKey: queryKeys.books(),
    queryFn: () => api.get<SourceBook[]>('/books', { query: { limit: 50 } }).then((r) => r.data),
  });

  const jobs = useQuery({
    queryKey: ['books', 'jobs'],
    queryFn: () => api.get<BookJob[]>('/books/jobs/recent').then((r) => r.data),
    refetchInterval: (q) => {
      const data = q.state.data as BookJob[] | undefined;
      const active = data?.some((j) => !['completed', 'failed', 'done'].includes(j.status));
      return active ? 2500 : false;
    },
  });

  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      if (!file) throw new Error('No file');
      form.append('file', file);
      if (hints.title) form.append('title', hints.title);
      form.append('level', hints.level);
      if (hints.category) form.append('category', hints.category);
      if (hints.author) form.append('author', hints.author);
      return api.upload('/books', form);
    },
    onSuccess: () => {
      toast({ title: 'Book uploaded', description: 'Processing has started.', variant: 'success' });
      setFile(null);
      setHints((h) => ({ ...h, title: '', author: '', category: '' }));
      queryClient.invalidateQueries({ queryKey: queryKeys.books() });
      queryClient.invalidateQueries({ queryKey: ['books', 'jobs'] });
    },
    onError: (err) => toast({ title: 'Upload failed', description: err instanceof ApiError ? err.message : undefined, variant: 'error' }),
  });

  const process = useMutation({
    mutationFn: (bookId: string) => api.post(`/books/${bookId}/process`),
    onSuccess: () => {
      toast({ title: 'Processing queued', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['books', 'jobs'] });
    },
  });

  const recentJobs = jobs.data ?? [];

  return (
    <div>
      <PageHeader
        title="Source books"
        description="Upload textbooks and let the pipeline extract modules, lessons and draft questions."
        actions={
          <Button variant="outline" onClick={() => void jobs.refetch()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="h-fit p-6">
          <div className="mb-4 flex items-center gap-2">
            <BookUp className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-slate-900">Upload a book</h2>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">File (PDF or DOCX)</Label>
              <input
                id="file"
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
              />
            </div>
            <div>
              <Label htmlFor="title">Title (optional)</Label>
              <Input id="title" value={hints.title} onChange={(e) => setHints((h) => ({ ...h, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="level">Level</Label>
                <Select id="level" value={hints.level} onChange={(e) => setHints((h) => ({ ...h, level: e.target.value }))}>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Input id="category" value={hints.category} onChange={(e) => setHints((h) => ({ ...h, category: e.target.value }))} />
              </div>
            </div>
            <Button className="w-full" disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
              <Upload className="h-4 w-4" />
              {upload.isPending ? 'Uploading…' : 'Upload & process'}
            </Button>
          </div>
        </Card>

        <div className="space-y-8">
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Processing jobs</h2>
            {jobs.isLoading ? (
              <Skeleton className="h-40" />
            ) : recentJobs.length ? (
              <div className="space-y-3">
                {recentJobs.map((job) => {
                  const book = typeof job.book === 'object' ? job.book : null;
                  return (
                    <Card key={job._id} className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{book?.title || book?.originalFilename || 'Book'}</p>
                          <p className="text-xs text-slate-400">{formatDateTime(job.createdAt)}</p>
                        </div>
                        <Badge
                          variant={
                            job.status === 'completed' || job.status === 'done'
                              ? 'accent'
                              : job.status === 'failed'
                                ? 'danger'
                                : 'warning'
                          }
                        >
                          {job.status}
                        </Badge>
                      </div>
                      {typeof job.progress === 'number' && (
                        <Progress value={job.progress} className="mt-3" />
                      )}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(job.steps ?? []).map((step, i) => (
                          <Badge
                            key={i}
                            variant={step.status === 'done' ? 'accent' : step.status === 'failed' ? 'danger' : step.status === 'active' ? 'brand' : 'default'}
                          >
                            {step.name}
                          </Badge>
                        ))}
                      </div>
                      {job.error && <p className="mt-2 text-xs text-red-600">{job.error}</p>}
                      {job.result?.warnings?.length ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-amber-600">{job.result.warnings.length} warning(s)</summary>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-500">
                            {job.result.warnings.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="No jobs yet" description="Uploaded books will appear here." />
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Library</h2>
            {books.isLoading ? (
              <Skeleton className="h-40" />
            ) : (books.data ?? []).length ? (
              <div className="space-y-2">
                {(books.data ?? []).map((book) => (
                  <Card key={book._id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{book.title}</p>
                      <p className="text-xs text-slate-400">
                        {book.level} · {book.originalFilename} · {Math.round(book.sizeBytes / 1024)} KB
                      </p>
                      <p className="text-xs text-slate-400">Added {formatDateTime(book.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={book.status === 'processed' || book.status === 'ready' ? 'accent' : 'default'}>{book.status}</Badge>
                      <Button size="sm" variant="outline" onClick={() => process.mutate(book._id)}>
                        Reprocess
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState title="No books uploaded" description="Upload a textbook to get started." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
