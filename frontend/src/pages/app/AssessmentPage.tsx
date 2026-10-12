import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/query';
import { newId } from '@/lib/offline/db';
import { useToast } from '@/components/ui/toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { AttemptResult, QuestionFeedback, StartedAttempt } from '@/types';

interface Summary {
  id: string;
  title: string;
  instructions?: string;
  passMarkPercent: number;
  timeLimitMinutes: number | null;
  attemptsAllowed: number;
  attemptsRemaining: number;
  questionCount: number;
  offlineAllowed: boolean;
}

export function AssessmentPage() {
  const { assessmentId = '' } = useParams();
  const { toast } = useToast();
  const [attempt, setAttempt] = useState<StartedAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [feedback, setFeedback] = useState<QuestionFeedback[] | null>(null);

  const summary = useQuery({
    queryKey: queryKeys.assessment(assessmentId),
    queryFn: () => api.get<Summary>(`/assessments/${assessmentId}`).then((r) => r.data),
  });

  const start = useMutation({
    mutationFn: () => api.post<StartedAttempt>(`/assessments/${assessmentId}/attempts`, { clientAttemptId: newId() }),
    onSuccess: (res) => {
      setAttempt(res.data);
      setAnswers({});
      setResult(null);
      setFeedback(null);
    },
    onError: (err) => toast({ title: 'Could not start', description: err instanceof ApiError ? err.message : undefined, variant: 'error' }),
  });

  const submit = useMutation({
    mutationFn: () =>
      api.post<AttemptResult>(`/assessments/attempts/${attempt!.attemptId}`, {
        answers: Object.entries(answers).map(([questionId, selectedOptionId]) => ({ questionId, selectedOptionId })),
      }),
    onSuccess: async (res) => {
      setResult(res.data);
      try {
        const fb = await api.get<{ attempt: AttemptResult; feedback?: QuestionFeedback[] }>(`/assessments/attempts/${attempt!.attemptId}`);
        setFeedback(fb.data.feedback ?? null);
      } catch {
        setFeedback(null);
      }
    },
    onError: (err) => toast({ title: 'Could not submit', description: err instanceof ApiError ? err.message : undefined, variant: 'error' }),
  });

  const answeredCount = Object.keys(answers).length;

  if (summary.isLoading) {
    return <Skeleton className="h-64 w-full max-w-2xl" />;
  }

  if (summary.isError || !summary.data) {
    return (
      <div className="max-w-2xl">
        <Alert variant="error">This assessment is not available.</Alert>
      </div>
    );
  }

  const s = summary.data;

  if (result) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="overflow-hidden">
          <div className={cn('px-6 py-8 text-center', result.passed ? 'bg-accent-50' : 'bg-red-50')}>
            {result.passed ? (
              <CheckCircle2 className="mx-auto h-12 w-12 text-accent-600" />
            ) : (
              <XCircle className="mx-auto h-12 w-12 text-red-500" />
            )}
            <p className="mt-3 text-2xl font-bold text-slate-900">{result.percent}%</p>
            <p className="text-sm text-slate-600">
              {result.passed ? 'You passed this assessment.' : `Minimum pass mark is ${s.passMarkPercent}%.`}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Score {result.score} / {result.maxScore} · {result.status}
            </p>
          </div>
          {feedback && feedback.length > 0 && (
            <div className="divide-y divide-slate-100 p-6">
              {feedback.map((f, i) => (
                <div key={f.questionId} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-2">
                    {f.isCorrect ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {i + 1}. {f.questionText}
                      </p>
                      {!f.isCorrect && (
                        <p className="mt-1 text-xs text-slate-500">
                          Correct answer: {f.correctOptionId}
                          {f.explanation ? ` — ${f.explanation}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-center gap-2 border-t border-slate-100 p-6">
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setFeedback(null);
                setAttempt(null);
              }}
            >
              Back to assessment
            </Button>
            <Button asChild>
              <Link to="/app/courses">Back to my courses</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">{s.title}</h1>
          {s.instructions && <p className="mt-3 text-sm text-slate-600">{s.instructions}</p>}
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm text-slate-500">
            <Badge variant="brand">{s.questionCount} questions</Badge>
            <Badge variant="outline">Pass mark {s.passMarkPercent}%</Badge>
            <Badge variant="outline">{s.attemptsRemaining} of {s.attemptsAllowed} attempts left</Badge>
            {s.timeLimitMinutes && (
              <Badge variant="warning" className="gap-1">
                <Clock className="h-3.5 w-3.5" />
                {s.timeLimitMinutes} min
              </Badge>
            )}
          </div>
          {s.attemptsRemaining <= 0 ? (
            <Alert variant="warning" className="mt-6">You have used all your attempts for this assessment.</Alert>
          ) : (
            <Button size="lg" className="mt-6" onClick={() => start.mutate()} disabled={start.isPending}>
              {start.isPending ? 'Starting…' : 'Start assessment'}
            </Button>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>
            {answeredCount} of {attempt.questions.length} answered
          </span>
          {attempt.timeLimitMinutes && <span>Time limit {attempt.timeLimitMinutes} min</span>}
        </div>
        <Progress value={(answeredCount / Math.max(1, attempt.questions.length)) * 100} />
      </div>

      <div className="space-y-4">
        {attempt.questions.map((q, idx) => (
          <Card key={q.id} className="p-5">
            <p className="font-medium text-slate-800">
              {idx + 1}. {q.questionText}
            </p>
            <div className="mt-3 space-y-2">
              {q.options.map((opt) => {
                const selected = answers[q.id] === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                      selected ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-slate-200 hover:bg-slate-50',
                    )}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={selected}
                      onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                      className="h-4 w-4 accent-brand-600"
                    />
                    <span>{opt.text}</span>
                  </label>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        {answeredCount < attempt.questions.length ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {attempt.questions.length - answeredCount} unanswered
          </span>
        ) : (
          <span />
        )}
        <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
          {submit.isPending ? 'Submitting…' : 'Submit assessment'}
        </Button>
      </div>
    </div>
  );
}
