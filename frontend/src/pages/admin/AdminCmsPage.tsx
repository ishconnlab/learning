import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, UploadCloud } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/empty-state';
import { cn, titleCase } from '@/lib/utils';
import type { CmsPage } from '@/types';

interface PageSummary {
  key: string;
  title: string;
  status?: string;
  publishedAt?: string;
}

export function AdminCmsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  const pages = useQuery({
    queryKey: ['cms', 'pages-admin'],
    queryFn: () => api.get<PageSummary[]>('/cms/pages').then((r) => r.data),
  });

  const page = useQuery({
    queryKey: ['cms', 'page', selected],
    queryFn: () => api.get<CmsPage>(`/cms/pages/${selected}`).then((r) => r.data),
    enabled: Boolean(selected),
  });

  useEffect(() => {
    if (page.data) {
      setTitle(page.data.title);
      setContent(JSON.stringify(page.data.content || page.data.publishedContent || {}, null, 2));
    }
  }, [page.data]);

  const save = useMutation({
    mutationFn: () => {
      const parsed = JSON.parse(content || '{}') as Record<string, unknown>;
      return api.put(`/cms/pages/${selected}`, { title, content: parsed });
    },
    onSuccess: () => {
      toast({ title: 'Draft saved', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['cms', 'page', selected] });
    },
    onError: (err) => toast({ title: 'Could not save', description: err instanceof ApiError ? err.message : undefined, variant: 'error' }),
  });

  const publish = useMutation({
    mutationFn: () => api.post(`/cms/pages/${selected}/publish`),
    onSuccess: () => {
      toast({ title: 'Page published', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['cms'] });
    },
  });

  const unpublish = useMutation({
    mutationFn: () => api.post(`/cms/pages/${selected}/unpublish`),
    onSuccess: () => {
      toast({ title: 'Page unpublished', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['cms'] });
    },
  });

  const handleSave = () => {
    try {
      JSON.parse(content);
      setParseError(null);
    } catch {
      setParseError('Content must be valid JSON.');
      return;
    }
    save.mutate();
  };

  return (
    <div>
      <PageHeader title="Content (CMS)" description="Edit the public pages shown on the landing site." />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">Pages</div>
          {pages.isLoading ? (
            <div className="p-4">
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <nav className="p-2">
              {(pages.data ?? []).map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setSelected(p.key)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm',
                    selected === p.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  <span className="truncate">{p.title || titleCase(p.key)}</span>
                  <span className={cn('text-[10px] uppercase', selected === p.key ? 'text-brand-100' : 'text-slate-400')}>
                    {p.status || 'draft'}
                  </span>
                </button>
              ))}
            </nav>
          )}
        </Card>

        <div>
          {!selected ? (
            <Card className="p-10 text-center text-sm text-slate-500">Select a page to edit its content.</Card>
          ) : page.isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <Badge variant={page.data?.status === 'published' ? 'accent' : 'default'}>{page.data?.status || 'draft'}</Badge>
                <div className="flex gap-2">
                  {page.data?.status === 'published' ? (
                    <Button variant="outline" size="sm" onClick={() => unpublish.mutate()} disabled={unpublish.isPending}>
                      Unpublish
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => publish.mutate()} disabled={publish.isPending || !page.data}>
                      <UploadCloud className="h-4 w-4" />
                      Publish
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="page-title">Title</Label>
                  <Input id="page-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="page-content">Content (JSON)</Label>
                  <Textarea
                    id="page-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-[320px] font-mono text-xs"
                  />
                  {parseError && <p className="mt-1 text-xs text-red-600">{parseError}</p>}
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={save.isPending}>
                    <Save className="h-4 w-4" />
                    {save.isPending ? 'Saving…' : 'Save draft'}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
