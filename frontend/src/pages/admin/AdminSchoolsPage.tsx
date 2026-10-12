import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton, EmptyState } from '@/components/ui/empty-state';
import { titleCase } from '@/lib/utils';
import type { School } from '@/types';

interface MemberRow {
  _id: string;
  role: string;
  title?: string;
  status: string;
  user?: { _id: string; name: string; email: string; role: string };
}

export function AdminSchoolsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', district: '', province: '', adminName: '', adminEmail: '', adminPassword: '' });
  const [selected, setSelected] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState({ name: '', email: '', password: '', role: 'student' });

  const schools = useQuery({
    queryKey: ['schools', 'list'],
    queryFn: () => api.get<School[]>('/schools', { query: { limit: 100 } }).then((r) => r.data),
  });

  const members = useQuery({
    queryKey: ['schools', selected, 'members'],
    queryFn: () => api.get<MemberRow[]>(`/schools/${selected}/members`).then((r) => r.data),
    enabled: Boolean(selected),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post('/schools', {
        name: form.name,
        district: form.district || undefined,
        province: form.province || undefined,
        admin: form.adminEmail ? { name: form.adminName, email: form.adminEmail, password: form.adminPassword } : undefined,
      }),
    onSuccess: () => {
      toast({ title: 'School created', variant: 'success' });
      setForm({ name: '', district: '', province: '', adminName: '', adminEmail: '', adminPassword: '' });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['schools', 'list'] });
    },
    onError: (err) => toast({ title: 'Could not create school', description: err instanceof ApiError ? err.message : undefined, variant: 'error' }),
  });

  const addMember = useMutation({
    mutationFn: () =>
      api.post(`/schools/${selected}/members`, {
        name: memberForm.name,
        email: memberForm.email,
        password: memberForm.password || undefined,
        role: memberForm.role,
      }),
    onSuccess: () => {
      toast({ title: 'Member added', variant: 'success' });
      setMemberForm({ name: '', email: '', password: '', role: 'student' });
      queryClient.invalidateQueries({ queryKey: ['schools', selected, 'members'] });
    },
    onError: (err) => toast({ title: 'Could not add member', description: err instanceof ApiError ? err.message : undefined, variant: 'error' }),
  });

  const items = schools.data ?? [];

  return (
    <div>
      <PageHeader
        title="Schools"
        description="Manage schools and their members."
        actions={
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            New school
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Create school</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <Label htmlFor="name">School name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="district">District</Label>
              <Input id="district" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="province">Province</Label>
              <Input id="province" value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} />
            </div>
            <div />
            <div className="sm:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Initial school admin (optional)</p>
            </div>
            <div>
              <Label htmlFor="adminName">Admin name</Label>
              <Input id="adminName" value={form.adminName} onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="adminEmail">Admin email</Label>
              <Input id="adminEmail" type="email" value={form.adminEmail} onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="adminPassword">Admin password</Label>
              <Input id="adminPassword" type="password" value={form.adminPassword} onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => create.mutate()} disabled={create.isPending || form.name.trim().length < 2}>
              {create.isPending ? 'Creating…' : 'Create school'}
            </Button>
          </div>
        </Card>
      )}

      {schools.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : items.length ? (
        <div className="space-y-2">
          {items.map((school) => (
            <Card key={school._id} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setSelected(selected === school._id ? null : school._id)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{school.name}</p>
                  <p className="text-xs text-slate-400">
                    {school.code}
                    {school.district ? ` · ${school.district}` : ''}
                    {school.province ? `, ${school.province}` : ''}
                  </p>
                </div>
                <Badge variant={school.status === 'active' ? 'accent' : 'default'}>{titleCase(school.status)}</Badge>
              </button>

              {selected === school._id && (
                <div className="border-t border-slate-100 bg-slate-50 p-4">
                  <div className="mb-3 grid gap-3 sm:grid-cols-4">
                    <Input placeholder="Name" value={memberForm.name} onChange={(e) => setMemberForm((f) => ({ ...f, name: e.target.value }))} />
                    <Input placeholder="Email" value={memberForm.email} onChange={(e) => setMemberForm((f) => ({ ...f, email: e.target.value }))} />
                    <Input placeholder="Password (new users)" type="password" value={memberForm.password} onChange={(e) => setMemberForm((f) => ({ ...f, password: e.target.value }))} />
                    <div className="flex gap-2">
                      <Select value={memberForm.role} onChange={(e) => setMemberForm((f) => ({ ...f, role: e.target.value }))}>
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                        <option value="school_admin">School admin</option>
                      </Select>
                      <Button
                        size="icon"
                        className="shrink-0"
                        disabled={addMember.isPending || !memberForm.name || !memberForm.email}
                        onClick={() => addMember.mutate()}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {members.isLoading ? (
                    <p className="text-xs text-slate-400">Loading members…</p>
                  ) : (members.data ?? []).length ? (
                    <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                      {(members.data ?? []).map((m) => (
                        <li key={m._id} className="flex items-center justify-between px-4 py-2 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-700">{m.user?.name || 'Member'}</p>
                            <p className="truncate text-xs text-slate-400">{m.user?.email}</p>
                          </div>
                          <Badge variant="default">{titleCase(m.role)}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">No members yet.</p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No schools" description="Create a school to get started." />
      )}
    </div>
  );
}
