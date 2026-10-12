import { useCallback, useEffect, useState } from 'react';
import {
  initInstallCapture,
  isInstallAvailable,
  isInstalled,
  promptInstall,
  subscribeInstall,
  type InstallOutcome,
} from './installApp';

/**
 * Exposes install state and a direct install action for the web app.
 */
export function useInstallApp() {
  const [canInstall, setCanInstall] = useState(isInstallAvailable);
  const [installed, setInstalled] = useState(isInstalled);

  useEffect(() => {
    initInstallCapture();
    const sync = () => {
      setCanInstall(isInstallAvailable());
      setInstalled(isInstalled());
    };
    sync();
    return subscribeInstall(sync);
  }, []);

  const installApp = useCallback((): Promise<InstallOutcome> => promptInstall(), []);

  return { canInstall, installed, installApp };
}
