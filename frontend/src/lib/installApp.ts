export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Capture the install prompt as early as possible (called from main.tsx) so a
 * direct "Install app" action is available whenever the browser allows it.
 */
export function initInstallCapture() {
  if (typeof window === 'undefined') return;
  const w = window as Window & { __ishInstallInit?: boolean };
  if (w.__ishInstallInit) return;
  w.__ishInstallInit = true;

  installed = detectStandalone();

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    notify();
  });
}

export function isInstallAvailable() {
  return deferredPrompt !== null;
}

export function isInstalled() {
  return installed || detectStandalone();
}

export function subscribeInstall(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function promptInstall(): Promise<InstallOutcome> {
  const prompt = deferredPrompt;
  if (!prompt) return 'unavailable';
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  if (outcome === 'accepted') {
    deferredPrompt = null;
    notify();
    return 'accepted';
  }
  return 'dismissed';
}
