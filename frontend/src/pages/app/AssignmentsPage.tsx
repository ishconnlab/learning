import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton, EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils';
import type { Assignment } from '@/types';

export function AssignmentsPage() {
  const query = useQuery({
    queryKey: queryKeys.assignments(),
    queryFn: () => api.get<Assignment[]>('/assignments').then((r) => r.data),
  });

  const items = query.data ?? [];

  return (
    <div>
      <PageHeader title="Assignments" description="Tasks assigned to you by your teachers." />

      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : items.length ? (
        <div className="space-y-3">
          {items.map((a) => {
            const overdue = a.dueAt ? new Date(a.dueAt) < new Date() : false;
            return (
              <Card key={a._id} className="flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <Link to={`/app/assignments/${a._id}`} className="font-medium text-slate-800 hover:text-brand-700">
                    {a.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {a.dueAt ? `Due ${formatDate(a.dueAt)}` : 'No deadline'}
                    {a.marks ? ` · ${a.marks} marks` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={overdue ? 'danger' : 'default'}>{overdue ? 'Overdue' : a.status}</Badge>
                  <Link to={`/app/assignments/${a._id}`} className="text-sm font-medium text-brand-600 hover:underline">
                    Open
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<FileText className="h-8 w-8" />} title="No assignments" description="You have no assignments right now." />
      )}
    </div>
  );
}
