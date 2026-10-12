import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthShell } from '@/components/layout/AuthShell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { api, ApiError } from '@/lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setDevToken(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ message: string; devToken?: string }>('/auth/forgot-password', { email: email.trim() });
      setMessage(res.data.message);
      if (res.data.devToken) setDevToken(res.data.devToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to process your request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send reset instructions."
      footer={
        <Link to="/login" className="link-brand font-semibold">
          ← Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {message && (
          <Alert variant="success">
            {message}
            {devToken && (
              <div className="mt-2">
                <Link to={`/reset-password?token=${encodeURIComponent(devToken)}`} className="link-brand font-semibold">
                  Open reset link (development)
                </Link>
              </div>
            )}
          </Alert>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset instructions'}
        </Button>
      </form>
    </AuthShell>
  );
}
