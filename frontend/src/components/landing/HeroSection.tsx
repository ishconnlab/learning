import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { PromoBadge } from './PromoBadge';
import { StudentIllustration } from './StudentIllustration';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function HeroSection() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    navigate(`/register?email=${encodeURIComponent(value)}`);
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-white via-brand-50/60 to-accent-50/40">
      {/* decorative white diagonal bands + circles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <span className="absolute -left-16 top-24 h-40 w-[140%] -rotate-[18deg] bg-white/70" />
        <span className="absolute -left-20 top-52 h-24 w-[130%] -rotate-[18deg] bg-white/50" />
        <span className="absolute -right-24 bottom-10 h-44 w-[120%] -rotate-[18deg] bg-white/60" />
        <span className="absolute right-10 top-16 h-40 w-40 rounded-full bg-brand-50" />
        <span className="absolute left-6 bottom-16 h-16 w-16 rounded-full bg-accent-100" />
      </div>

      <div className="relative grid gap-10 px-6 py-12 sm:px-10 lg:grid-cols-2 lg:items-center lg:px-14 lg:py-16">
        <div className="relative z-10 flex flex-col justify-center">
          <PromoBadge className="w-fit" />

          <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl xl:text-6xl">
            Welcome to
            <br />
            Online Class.
          </h1>

          <p className="mt-5 max-w-md text-base leading-relaxed text-slate-500">
            Learn from official Rwandan textbooks with structured modules, practical activities and
            assessments — online or fully offline, on any device.
          </p>

          <form onSubmit={onSubmit} noValidate className="mt-7 max-w-md">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <label htmlFor="hero-email" className="sr-only">
                  Your email address
                </label>
                <input
                  id="hero-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Your email address"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'hero-email-error' : undefined}
                  className="w-full rounded-full border border-slate-200 bg-white px-5 py-3.5 text-sm text-slate-700 outline-none transition focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                />
              </div>
              <button
                type="submit"
                className="rounded-full bg-accent-500 px-7 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2"
              >
                Sign Up
              </button>
            </div>
            {error && (
              <p id="hero-email-error" role="alert" className="mt-2 pl-2 text-xs font-medium text-red-600">
                {error}
              </p>
            )}
          </form>

          <div className="mt-6 flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white">
              <Check className="h-4 w-4" />
            </span>
            <p className="text-sm leading-6 text-slate-500">
              No credit card required.
              <br />
              Free courses and offline downloads included.
            </p>
          </div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-md">
          <div className="relative aspect-square">
            <div className="absolute inset-0 rounded-full bg-brand-100/70 blur-2xl" />
            <div className="blob-mask relative h-full w-full overflow-hidden shadow-2xl">
              <StudentIllustration />
            </div>
            <span className="absolute -left-3 top-8 h-16 w-16 rounded-full bg-white shadow-lg" aria-hidden="true" />
            <span className="absolute -right-2 bottom-16 h-10 w-10 rounded-full bg-white shadow-lg" aria-hidden="true" />
            <span className="absolute -bottom-3 left-1/3 h-14 w-24 rounded-2xl bg-white/90 shadow-lg" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
