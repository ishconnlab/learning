import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

interface VerifyResult {
  valid: boolean;
  status: string;
  recipient?: string;
  course?: string;
  level?: string;
  institution?: string;
  issuedAt?: string;
  completionDate?: string;
  revokedAt?: string | null;
  revocationReason?: string | null;
}

export function VerifyCertificatePage() {
  const { certificateId: routeId } = useParams();
  const [params] = useSearchParams();
  const [input, setInput] = useState(routeId || params.get('id') || '');
  const [submitted, setSubmitted] = useState(routeId || params.get('id') || '');

  const result = useQuery({
    queryKey: ['verify', submitted],
    queryFn: () => api.get<VerifyResult>(`/certificates/verify/${encodeURIComponent(submitted)}`).then((r) => r.data),
    enabled: submitted.length > 0,
    retry: false,
  });

  useEffect(() => {
    if (routeId && routeId !== submitted) {
      setInput(routeId);
      setSubmitted(routeId);
    }
  }, [routeId, submitted]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(input.trim());
  };

  const data = result.data;

  return (
    <div className="container-page max-w-2xl py-14">
      <PageHeader
        title="Verify a certificate"
        description="Enter the certificate ID printed on the document to confirm its authenticity."
      />

      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="certificateId">Certificate ID</Label>
          <Input
            id="certificateId"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. ISH-2026-000123"
            required
          />
        </div>
        <Button type="submit" disabled={result.isFetching || !input.trim()}>
          {result.isFetching ? 'Checking…' : 'Verify'}
        </Button>
      </form>

      {data && (
        <Card className="mt-8 overflow-hidden">
          <div className={data.valid ? 'bg-accent-50 px-6 py-5' : 'bg-red-50 px-6 py-5'}>
            <div className="flex items-center gap-3">
              {data.valid ? (
                <BadgeCheck className="h-8 w-8 text-accent-600" />
              ) : data.status === 'not_found' ? (
                <ShieldX className="h-8 w-8 text-red-600" />
              ) : (
                <ShieldAlert className="h-8 w-8 text-red-600" />
              )}
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {data.valid ? 'Valid certificate' : data.status === 'not_found' ? 'Not found' : 'Certificate revoked'}
                </p>
                <p className="text-sm text-slate-600">
                  {data.valid
                    ? 'This certificate was issued by IshConnect LMS.'
                    : data.status === 'not_found'
                      ? 'No certificate matches this ID.'
                      : 'This certificate is no longer valid.'}
                </p>
              </div>
            </div>
          </div>
          {data.status !== 'not_found' && (
            <dl className="grid gap-4 p-6 sm:grid-cols-2">
              <Field label="Recipient" value={data.recipient} />
              <Field label="Institution" value={data.institution} />
              <Field label="Course" value={data.course} />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Level</dt>
                <dd className="mt-1">
                  <Badge variant="brand">{data.level || '—'}</Badge>
                </dd>
              </div>
              <Field label="Completion date" value={formatDate(data.completionDate)} />
              <Field label="Issued on" value={formatDate(data.issuedAt)} />
              {data.status === 'revoked' && data.revocationReason && (
                <Field label="Revocation reason" value={data.revocationReason} />
              )}
            </dl>
          )}
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-800">{value || '—'}</dd>
    </div>
  );
}
