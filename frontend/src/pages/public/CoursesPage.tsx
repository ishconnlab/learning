import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api, type PaginationMeta } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { PageHeader } from '@/components/PageHeader';
import { CourseCard } from '@/components/CourseCard';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton, EmptyState } from '@/components/ui/empty-state';
import type { Course } from '@/types';

interface Filters {
  levels: string[];
  categories: string[];
}

export function CoursesPage() {
  const [params] = useSearchParams();
  const [q, setQ] = useState(() => params.get('q') ?? '');
  const [level, setLevel] = useState(() => params.get('level') ?? '');
  const [category, setCategory] = useState(() => params.get('category') ?? '');
  const [page, setPage] = useState(1);

  const filters = useQuery({
    queryKey: ['courses', 'filters'],
    queryFn: () => api.get<Filters>('/courses/meta/filters').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  const list = useQuery({
    queryKey: queryKeys.courses({ q, level, category, page }),
    queryFn: () =>
      api
        .get<Course[]>('/courses', { query: { q: q || undefined, level: level || undefined, category: category || undefined, page } })
        .then((r) => ({ items: r.data, meta: r.meta as PaginationMeta })),
  });

  const items = list.data?.items ?? [];
  const meta = list.data?.meta;

  return (
    <div className="container-page py-12">
      <PageHeader
        title="Course catalog"
        description="Explore book-based courses for TVET levels 3–5 and general education."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search courses…"
            className="pl-9"
          />
        </div>
        <Select
          value={level}
          onChange={(e) => {
            setLevel(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All levels</option>
          {(filters.data?.levels ?? []).map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
        <Select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {(filters.data?.categories ?? []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      {list.isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : items.length ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((course) => (
              <CourseCard key={course._id} course={course} />
            ))}
          </div>
          {meta && meta.pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-slate-500">
                Page {meta.page} of {meta.pages}
              </span>
              <Button variant="outline" disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState title="No courses found" description="Try adjusting your search or filters." />
      )}
    </div>
  );
}
