import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '@/components/layout/AuthShell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { api, ApiError } from '@/lib/api';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      window.setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to reset your password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Enter and confirm your new password."
      footer={
        <Link to="/login" className="link-brand font-semibold">
          ← Back to sign in
        </Link>
      }
    >
      {!token && <Alert variant="warning">This reset link is missing its token. Please request a new one.</Alert>}
      <form onSubmit={submit} className="mt-4 space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {done && <Alert variant="success">Password updated. Redirecting to sign in…</Alert>}
        <div>
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={submitting || !token}>
          {submitting ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthShell>
  );
}
