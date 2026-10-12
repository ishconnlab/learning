import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastVariant = 'info' | 'success' | 'warning' | 'error';

interface Toast {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (input: { title: string; description?: string; variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, ReactNode> = {
  info: <Info className="h-4 w-4 text-brand-600" />,
  success: <CheckCircle2 className="h-4 w-4 text-accent-600" />,
  warning: <TriangleAlert className="h-4 w-4 text-amber-600" />,
  error: <TriangleAlert className="h-4 w-4 text-red-600" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = 'info' }: { title: string; description?: string; variant?: ToastVariant }) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 rounded-xl border bg-white p-3.5 shadow-lg animate-slide-up',
              t.variant === 'error' && 'border-red-200',
              t.variant === 'success' && 'border-accent-200',
              t.variant === 'warning' && 'border-amber-200',
              t.variant === 'info' && 'border-slate-200',
            )}
          >
            <span className="mt-0.5">{ICONS[t.variant]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-slate-500">{t.description}</p>}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-600" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
