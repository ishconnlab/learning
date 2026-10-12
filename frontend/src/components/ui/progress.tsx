import { cn } from '@/lib/utils';

export function Progress({ value = 0, className, tone = 'brand' }: { value?: number; className?: string; tone?: 'brand' | 'accent' }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-200', className)}
    >
      <div
        className={cn('h-full rounded-full transition-all', tone === 'accent' ? 'bg-accent-500' : 'bg-brand-500')}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
