import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { newId } from '@/lib/offline/db';
import { useAuth } from '@/store/auth';
import { useToast } from '@/components/ui/toast';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/empty-state';
import { formatDateTime } from '@/lib/utils';
import type { Assignment, AssignmentSubmission } from '@/types';

interface Detail {
  assignment: Assignment;
  mySubmission: AssignmentSubmission | null;
}

export function AssignmentDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isStudent = user?.role === 'student';

  const query = useQuery({
    queryKey: queryKeys.assignment(id),
    queryFn: () => api.get<Detail | Assignment>(`/assignments/${id}`).then((r) => {
      const data = r.data as Detail;
      return data.assignment ? data : { assignment: data as unknown as Assignment, mySubmission: null };
    }),
  });

  const [content, setContent] = useState('');
  const [clientId] = useState(() => newId());

  const submit = useMutation({
    mutationFn: (submitNow: boolean) =>
      api.post(`/assignments/${id}/submissions`, {
        clientSubmissionId: clientId,
        content,
        submit: submitNow,
      }),
    onSuccess: (_res, submitNow) => {
      toast({ title: submitNow ? 'Assignment submitted' : 'Draft saved', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: queryKeys.assignment(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments() });
    },
    onError: (err) => toast({ title: 'Could not save', description: err instanceof ApiError ? err.message : undefined, variant: 'error' }),
  });

  const assignment = query.data?.assignment;
  const submission = query.data?.mySubmission;

  if (query.isLoading) {
    return (
      <div className="max-w-3xl">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="max-w-3xl">
        <Alert variant="error">This assignment could not be found.</Alert>
        <Link to="/app/assignments" className="link-brand mt-4 inline-block text-sm">
          ← Back to assignments
        </Link>
      </div>
    );
  }

  const submitted = submission && ['submitted', 'late', 'graded', 'returned'].includes(submission.status);

  return (
    <div className="max-w-3xl">
      <Link to="/app/assignments" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" />
        Back to assignments
      </Link>
      <PageHeader
        title={assignment.title}
        description={assignment.dueAt ? `Due ${formatDateTime(assignment.dueAt)}` : undefined}
        actions={submission ? <Badge variant={submitted ? 'accent' : 'warning'}>{submission.status}</Badge> : <Badge>{assignment.status}</Badge>}
      />

      {assignment.instructions && (
        <Card className="mb-6 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Instructions</h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{assignment.instructions}</p>
          {assignment.deliverables?.length ? (
            <div className="mt-4">
              <p className="text-sm font-semibold text-slate-700">Deliverables</p>
              <ul className="mt-1 list-disc space-y-1 pl-6 text-sm text-slate-600">
                {assignment.deliverables.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      )}

      {submission?.grade != null && (
        <Alert variant="success" className="mb-6" title={`Graded: ${submission.grade}${assignment.marks ? ` / ${assignment.marks}` : ''}`}>
          {submission.feedback || 'No feedback provided.'}
        </Alert>
      )}

      {isStudent ? (
        submitted ? (
          <Card className="p-6">
            <div className="flex items-center gap-2 text-accent-600">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-medium">Submitted {submission?.submittedAt ? formatDateTime(submission.submittedAt) : ''}</p>
            </div>
            {submission?.content && <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{submission.content}</p>}
          </Card>
        ) : (
          <Card className="p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Your submission</h2>
            <Textarea
              value={content || submission?.content || ''}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your answer or paste a link to your work…"
              className="min-h-[160px]"
            />
            <div className="mt-4 flex items-center gap-2">
              <Button onClick={() => submit.mutate(true)} disabled={submit.isPending}>
                {submit.isPending ? 'Submitting…' : 'Submit assignment'}
              </Button>
              <Button variant="outline" onClick={() => submit.mutate(false)} disabled={submit.isPending}>
                Save draft
              </Button>
              {assignment.dueAt && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="h-3.5 w-3.5" />
                  {assignment.allowLate ? 'Late submissions allowed' : 'No late submissions'}
                </span>
              )}
            </div>
          </Card>
        )
      ) : (
        <p className="text-sm text-slate-500">Open the teaching dashboard to review submissions.</p>
      )}
    </div>
  );
}
