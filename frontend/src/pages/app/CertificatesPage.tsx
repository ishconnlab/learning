import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Award, Download, ExternalLink } from 'lucide-react';
import { api, apiUrl, getToken } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { useAuth } from '@/store/auth';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton, EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils';
import type { Certificate } from '@/types';

export function CertificatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);
  const isStudent = user?.role === 'student';

  const query = useQuery({
    queryKey: queryKeys.certificates(),
    queryFn: () => api.get<Certificate[]>(isStudent ? '/certificates/mine' : '/certificates').then((r) => r.data),
  });

  const items = query.data ?? [];

  const download = async (cert: Certificate) => {
    setDownloading(cert.certificateId);
    try {
      const res = await fetch(apiUrl(`/certificates/${encodeURIComponent(cert.certificateId)}/pdf`), {
        headers: { Authorization: `Bearer ${getToken() ?? ''}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cert.certificateId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Could not download', description: 'The certificate file is not available.', variant: 'error' });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Certificates"
        description={isStudent ? 'Certificates you have earned.' : 'Certificates issued on the platform.'}
      />

      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : items.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((cert) => (
            <Card key={cert._id} className="overflow-hidden">
              <div className="flex items-center justify-between bg-gradient-to-br from-brand-600 to-brand-800 px-5 py-4">
                <Award className="h-7 w-7 text-white" />
                <Badge variant={cert.status === 'issued' ? 'accent' : 'warning'}>{cert.status}</Badge>
              </div>
              <div className="p-5">
                <p className="font-semibold text-slate-900">{cert.courseTitle}</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {cert.studentName} · {cert.courseLevel}
                </p>
                <p className="mt-1 text-xs text-slate-400">Issued {formatDate(cert.issuedAt)}</p>
                <p className="mt-2 font-mono text-xs text-slate-400">{cert.certificateId}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void download(cert)} disabled={downloading === cert.certificateId}>
                    <Download className="h-4 w-4" />
                    {downloading === cert.certificateId ? 'Downloading…' : 'PDF'}
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/verify/${cert.certificateId}`} target="_blank">
                      <ExternalLink className="h-4 w-4" />
                      Verify
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Award className="h-8 w-8" />}
          title="No certificates yet"
          description={isStudent ? 'Complete a course to earn your certificate.' : 'No certificates have been issued.'}
        />
      )}
    </div>
  );
}
