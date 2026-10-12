import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/empty-state';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDate, initials, titleCase } from '@/lib/utils';
import type { SchoolMembership } from '@/types';

interface FullUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  preferredLanguage?: string;
  avatarUrl?: string;
  createdAt?: string;
}

export function ProfilePage() {
  const { user, memberships, refresh } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const full = useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => api.get<FullUser & { schoolIds?: string[] }>('/users/me').then((r) => r.data),
  });

  const [form, setForm] = useState({ name: '', phone: '', preferredLanguage: 'en' });

  useEffect(() => {
    if (full.data) {
      setForm({
        name: full.data.name,
        phone: full.data.phone || '',
        preferredLanguage: full.data.preferredLanguage || 'en',
      });
    }
  }, [full.data]);

  const membershipsQuery = useQuery({
    queryKey: ['schools', 'mine'],
    queryFn: () => api.get<SchoolMembership[]>('/schools/mine').then((r) => r.data),
  });

  const save = useMutation({
    mutationFn: (payload: { name: string; phone?: string; preferredLanguage?: string }) => api.patch('/users/me', payload),
    onSuccess: async () => {
      toast({ title: 'Profile updated', variant: 'success' });
      await queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      await refresh();
    },
    onError: () => toast({ title: 'Could not save changes', variant: 'error' }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ name: form.name.trim(), phone: form.phone.trim() || undefined, preferredLanguage: form.preferredLanguage });
  };

  const schools = membershipsQuery.data ?? memberships;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Profile & settings" description="Manage your personal information." />

      <Card className="mb-6">
        <div className="flex items-center gap-4 p-6">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg">{initials(user?.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold text-slate-900">{user?.name}</p>
            <p className="text-sm text-slate-500">{user?.email}</p>
            <Badge variant="brand" className="mt-1">
              {user ? titleCase(user.role) : ''}
            </Badge>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
        </CardHeader>
        <CardContent>
          {full.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={user?.email || ''} disabled />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+250…" />
                </div>
              </div>
              <div>
                <Label htmlFor="lang">Preferred language</Label>
                <Select id="lang" value={form.preferredLanguage} onChange={(e) => setForm((f) => ({ ...f, preferredLanguage: e.target.value }))}>
                  <option value="en">English</option>
                  <option value="fr">French</option>
                  <option value="rw">Kinyarwanda</option>
                </Select>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
              {full.data?.createdAt && (
                <p className="text-xs text-slate-400">Member since {formatDate(full.data.createdAt)}</p>
              )}
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>School memberships</CardTitle>
        </CardHeader>
        <CardContent>
          {schools.length ? (
            <ul className="divide-y divide-slate-100">
              {schools.map((m) => {
                const school = typeof m.school === 'string' ? null : m.school;
                return (
                  <li key={m._id} className="flex items-center justify-between py-3 text-sm">
                    <span className="font-medium text-slate-700">{school?.name || 'School'}</span>
                    <Badge variant="default">{titleCase(m.role)}</Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">You are not a member of any school yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
