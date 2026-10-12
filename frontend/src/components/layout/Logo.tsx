import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function Logo({ className, to = '/', showText = true }: { className?: string; to?: string; showText?: boolean }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2.5', className)} aria-label="IshConnect LMS home">
      <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="M5 4.5v15M5 12h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M14 5.5 19 8v3.5c0 3.4-2.2 6.2-5 7.5-0.6-.3-1.2-.6-1.7-1" stroke="#7BE39B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {showText && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight text-slate-900">IshConnect</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-500">LMS</span>
        </span>
      )}
    </Link>
  );
}
