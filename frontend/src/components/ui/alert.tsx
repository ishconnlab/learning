import { type HTMLAttributes, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

const styles: Record<AlertVariant, { wrap: string; icon: ReactNode }> = {
  info: { wrap: 'border-brand-200 bg-brand-50 text-brand-800', icon: <Info className="h-4 w-4" /> },
  success: { wrap: 'border-accent-200 bg-accent-50 text-accent-800', icon: <CheckCircle2 className="h-4 w-4" /> },
  warning: { wrap: 'border-amber-200 bg-amber-50 text-amber-800', icon: <TriangleAlert className="h-4 w-4" /> },
  error: { wrap: 'border-red-200 bg-red-50 text-red-800', icon: <AlertCircle className="h-4 w-4" /> },
};

export function Alert({
  variant = 'info',
  title,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: AlertVariant; title?: string }) {
  const s = styles[variant];
  return (
    <div role="alert" className={cn('flex gap-3 rounded-xl border p-3.5 text-sm', s.wrap, className)} {...props}>
      <span className="mt-0.5 shrink-0">{s.icon}</span>
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'leading-relaxed')}>{children}</div>}
      </div>
    </div>
  );
}
