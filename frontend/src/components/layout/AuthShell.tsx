import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Logo } from './Logo';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Logo />
          <h1 className="mt-8 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-slate-500">{footer}</div>}
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-brand-800 lg:block">
        <div className="absolute inset-0 animate-fade-in" aria-hidden="true">
          <img
            src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1400&q=80"
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full origin-center animate-kenburns object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-brand-900/80 via-brand-800/70 to-brand-700/60" />
          <div className="absolute -left-16 top-24 h-64 w-64 rounded-full bg-accent-400/40 blur-3xl" />
          <div className="absolute bottom-16 right-0 h-72 w-72 rounded-full bg-brand-300/40 blur-3xl" />
        </div>
        <div className="relative flex h-full flex-col justify-center px-14 text-white">
          <h2 className="max-w-md animate-slide-up text-3xl font-bold leading-snug">
            Learn anywhere. Keep your progress, even offline.
          </h2>
          <p className="mt-4 max-w-md animate-fade-in text-brand-100">
            IshConnect LMS builds structured courses from official textbooks, with practical activities,
            assessments and a final project that proves your competence.
          </p>
          <div className="mt-10 space-y-3 text-sm text-brand-100">
            <p>• Works offline with automatic sync</p>
            <p>• Verifiable certificates</p>
            <p>• Built for TVET &amp; secondary education</p>
          </div>
          <Link to="/" className="mt-10 text-sm font-semibold text-white underline-offset-4 hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
