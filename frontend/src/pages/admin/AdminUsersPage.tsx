import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api, ApiError, type PaginationMeta } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton, EmptyState } from '@/components/ui/empty-state';
import { titleCase } from '@/lib/utils';
import type { Role } from '@/types';

interface UserRow {
  _id: string;
  name: string;
  email: string;
  role: Role;
  status: string;
  createdAt: string;
}

const ROLES: Role[] = ['platform_owner', 'platform_admin', 'school_admin', 'teacher', 'student'];

export function AdminUsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);

  const queryKey = ['users', { q, role, page }] as const;

  const users = useQuery({
    queryKey,
    queryFn: () =>
      api
        .get<UserRow[]>('/users', { query: { q: q || undefined, role: role || undefined, page } })
        .then((r) => ({ items: r.data, meta: r.meta as PaginationMeta })),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, nextRole }: { id: string; nextRole: Role }) => api.patch(`/users/${id}`, { role: nextRole }),
    onSuccess: () => {
      toast({ title: 'Role updated', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast({ title: 'Could not update role', description: err instanceof ApiError ? err.message : undefined, variant: 'error' }),
  });

  const items = users.data?.items ?? [];
  const meta = users.data?.meta;

  return (
    <div>
      <PageHeader title="Users" description="Manage platform accounts and roles." />

      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email…"
            className="pl-9"
          />
        </div>
        <Select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {titleCase(r)}
            </option>
          ))}
        </Select>
      </div>

      {users.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : items.length ? (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {items.map((u) => (
            <div key={u._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{u.name}</p>
                <p className="truncate text-xs text-slate-400">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={u.status === 'active' ? 'accent' : 'default'}>{u.status}</Badge>
                <Select
                  value={u.role}
                  onChange={(e) => updateRole.mutate({ id: u._id, nextRole: e.target.value as Role })}
                  className="h-8 w-40 text-xs"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {titleCase(r)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState title="No users found" description="Try a different search." />
      )}

      {meta && meta.pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm text-slate-500">
          <button className="link-brand disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {meta.page} of {meta.pages}
          </span>
          <button className="link-brand disabled:opacity-40" disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
