import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function PromoBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-stretch overflow-hidden rounded-full shadow-sm', className)}>
      <span className="bg-accent-500 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
        Discount 50%
      </span>
      <span className="bg-accent-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-700">
        Limited time only
      </span>
    </span>
  );
}

export function PromoBadgeLink({ to = '/courses', className }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={cn('inline-flex', className)}>
      <PromoBadge />
    </Link>
  );
}
