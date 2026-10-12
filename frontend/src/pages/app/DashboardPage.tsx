import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Award, BookOpen, FolderKanban, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/empty-state';
import { percent } from '@/lib/utils';
import type { Enrollment } from '@/types';

interface LearningSummary {
  enrollmentId: string;
  course: { _id: string; title: string; level: string } | null;
  completionPercent: number;
}

interface DashboardData {
  enrollments?: Enrollment[];
  summaries?: LearningSummary[];
  pendingSubmissions?: number;
  role?: string;
}

export function DashboardPage() {
  const { user } = useAuth();

  const dashboard = useQuery({
    queryKey: ['learning', 'dashboard'],
    queryFn: () => api.get<DashboardData>('/learning/dashboard').then((r) => r.data),
  });

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.name.split(' ')[0] ?? 'there'}`}
        description={user?.role === 'student' ? 'Pick up where you left off.' : 'Here is an overview of your workspace.'}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={<BookOpen className="h-5 w-5" />} label="Active courses" value={dashboard.data?.enrollments?.length ?? 0} loading={dashboard.isLoading} />
        <StatCard icon={<FolderKanban className="h-5 w-5" />} label="Pending submissions" value={dashboard.data?.pendingSubmissions ?? 0} loading={dashboard.isLoading} />
        <StatCard icon={<Award className="h-5 w-5" />} label="Completed" value={dashboard.data?.enrollments?.filter((e) => e.status === 'completed').length ?? 0} loading={dashboard.isLoading} />
      </div>

      <h2 className="mt-10 text-lg font-semibold text-slate-900">Continue learning</h2>
      {dashboard.isLoading ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (dashboard.data?.summaries ?? []).length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(dashboard.data?.summaries ?? []).map((s) => (
            <Card key={s.enrollmentId} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{s.course?.title || 'Course'}</p>
                  {s.course?.level && <Badge variant="brand" className="mt-1">{s.course.level}</Badge>}
                </div>
                <TrendingUp className="h-5 w-5 shrink-0 text-brand-500" />
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>Progress</span>
                  <span>{percent(s.completionPercent)}</span>
                </div>
                <Progress value={s.completionPercent} />
              </div>
              <Button asChild size="sm" className="mt-4" variant="subtle">
                <Link to={`/app/courses/${s.course?._id}`}>Resume</Link>
              </Button>
            </Card>
          ))}
        </div>
      ) : user?.role === 'student' ? (
        <Card className="mt-4 p-8 text-center">
          <p className="font-medium text-slate-700">You haven&apos;t started any course yet.</p>
          <p className="mt-1 text-sm text-slate-500">Browse the catalog and enroll to begin.</p>
          <Button asChild className="mt-4">
            <Link to="/app/catalog">Browse catalog</Link>
          </Button>
        </Card>
      ) : (
        <Card className="mt-4 p-6 text-sm text-slate-500">
          You are signed in as <span className="font-medium capitalize">{user?.role.replace('_', ' ')}</span>. Use the
          navigation to manage your work.
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: number; loading: boolean }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        {loading ? <Skeleton className="mt-1 h-6 w-10" /> : <p className="text-2xl font-bold text-slate-900">{value}</p>}
      </div>
    </Card>
  );
}
