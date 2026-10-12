import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/empty-state';
import { formatDateTime, percent } from '@/lib/utils';
import type { Course } from '@/types';

interface PlatformReport {
  schools: number;
  publishedCourses: number;
  enrollments: number;
  completedEnrollments: number;
  issuedCertificates: number;
  averageCompletionPercent: number;
}

interface AuditRow {
  _id: string;
  action: string;
  entityType?: string;
  severity?: string;
  createdAt: string;
}

export function AdminReportsPage() {
  const { user } = useAuth();
  const isPlatform = user?.role === 'platform_admin' || user?.role === 'platform_owner';
  const [courseId, setCourseId] = useState('');

  const platform = useQuery({
    queryKey: ['reports', 'platform'],
    queryFn: () => api.get<PlatformReport>('/reports/platform').then((r) => r.data),
    enabled: isPlatform,
  });

  const courses = useQuery({
    queryKey: ['courses', 'report-select'],
    queryFn: () => api.get<Course[]>('/courses', { query: { limit: 100 } }).then((r) => r.data),
  });

  const audit = useQuery({
    queryKey: ['reports', 'audit'],
    queryFn: () => api.get<AuditRow[]>('/reports/audit', { query: { limit: 20 } }).then((r) => (r.data)),
    enabled: isPlatform,
  });

  return (
    <div>
      <PageHeader title="Reports" description="Platform analytics and activity." />

      {isPlatform && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Schools" value={platform.data?.schools} loading={platform.isLoading} />
            <Stat label="Published courses" value={platform.data?.publishedCourses} loading={platform.isLoading} />
            <Stat label="Enrollments" value={platform.data?.enrollments} loading={platform.isLoading} />
            <Stat label="Certificates issued" value={platform.data?.issuedCertificates} loading={platform.isLoading} />
          </div>

          <Card className="mt-4 p-6">
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium text-slate-700">Average course completion</span>
              <span className="text-slate-500">{percent(platform.data?.averageCompletionPercent ?? 0)}</span>
            </div>
            <Progress value={platform.data?.averageCompletionPercent ?? 0} />
            <p className="mt-3 text-xs text-slate-400">
              {platform.data?.completedEnrollments ?? 0} of {platform.data?.enrollments ?? 0} enrollments completed.
            </p>
          </Card>
        </>
      )}

      <Card className="mt-8 p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Course report</h2>
        <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">Select a course…</option>
          {(courses.data ?? []).map((c) => (
            <option key={c._id} value={c._id}>
              {c.title}
            </option>
          ))}
        </Select>
        {courseId && <CourseReport courseId={courseId} />}
      </Card>

      {isPlatform && (
        <Card className="mt-8 overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Recent activity</h2>
          </div>
          {audit.isLoading ? (
            <div className="p-6">
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (audit.data ?? []).length ? (
            <ul className="divide-y divide-slate-100">
              {(audit.data ?? []).map((row) => (
                <li key={row._id} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-700">{row.action}</p>
                    <p className="text-xs text-slate-400">{row.entityType}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {row.severity === 'warning' && <Badge variant="warning">warning</Badge>}
                    <span className="text-xs text-slate-400">{formatDateTime(row.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-sm text-slate-500">No activity recorded.</p>
          )}
        </Card>
      )}
    </div>
  );
}

function CourseReport({ courseId }: { courseId: string }) {
  const report = useQuery({
    queryKey: ['reports', 'course', courseId],
    queryFn: () =>
      api
        .get<{
          enrollmentCount: number;
          completedCount: number;
          averageCompletionPercent: number;
          assessmentSummary: { title: string; attempts: number; passed: number; averagePercent: number }[];
        }>(`/reports/course/${courseId}`)
        .then((r) => r.data),
  });

  if (report.isLoading) return <Skeleton className="mt-4 h-32 w-full" />;
  if (!report.data) return null;

  return (
    <div className="mt-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Enrollments" value={report.data.enrollmentCount} />
        <Stat label="Completed" value={report.data.completedCount} />
        <Stat label="Avg. completion" value={report.data.averageCompletionPercent} suffix="%" />
      </div>
      {report.data.assessmentSummary.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2">Assessment</th>
                <th className="px-4 py-2">Attempts</th>
                <th className="px-4 py-2">Passed</th>
                <th className="px-4 py-2">Avg %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.data.assessmentSummary.map((a) => (
                <tr key={a.title}>
                  <td className="px-4 py-2 text-slate-700">{a.title}</td>
                  <td className="px-4 py-2 text-slate-500">{a.attempts}</td>
                  <td className="px-4 py-2 text-slate-500">{a.passed}</td>
                  <td className="px-4 py-2 text-slate-500">{a.averagePercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, loading, suffix = '' }: { label: string; value?: number; loading?: boolean; suffix?: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      {loading ? <Skeleton className="mt-1 h-6 w-12" /> : <p className="text-2xl font-bold text-slate-900">{(value ?? 0).toLocaleString()}{suffix}</p>}
    </Card>
  );
}
