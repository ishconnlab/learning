import { useState } from 'react';
import { Check, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInstallApp } from '@/lib/useInstallApp';
import { cn } from '@/lib/utils';

export function InstallAppCard({ className }: { className?: string }) {
  const { installed, installApp } = useInstallApp();
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const onInstall = async () => {
    setBusy(true);
    try {
      setUnavailable((await installApp()) === 'unavailable');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-6 shadow-card sm:p-8',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 animate-pulse rounded-full bg-accent-400/30 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-14 left-10 h-40 w-40 rounded-full bg-brand-400/30 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <img src="/pwa-192x192.png" alt="" className="h-9 w-9 rounded-lg" />
            <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-accent-400 ring-2 ring-brand-800" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-300">Get the app</p>
            <h3 className="mt-1 text-lg font-bold text-white">Install IshConnect on your device</h3>
            <p className="mt-1 max-w-md text-sm text-brand-100">
              Learn offline, launch straight from your home screen, and receive updates automatically.
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {installed ? (
            <span className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20">
              <Check className="h-4 w-4" aria-hidden="true" /> App installed
            </span>
          ) : (
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <Button variant="accent" size="lg" onClick={onInstall} disabled={busy}>
                <Download className="h-4 w-4" aria-hidden="true" /> {busy ? 'Installing…' : 'Install app'}
              </Button>
              {unavailable && (
                <span className="inline-flex max-w-[16rem] items-center gap-2 text-xs font-medium text-brand-100">
                  <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Use your browser menu → “Install app”.
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
