import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { db, pendingCount, type QueuedEvent } from './db';

let flushing = false;

export interface FlushResult {
  sent: number;
  failed: number;
}

export async function flushQueue(): Promise<FlushResult> {
  if (flushing) return { sent: 0, failed: 0 };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { sent: 0, failed: 0 };

  flushing = true;
  try {
    const pending: QueuedEvent[] = await db.syncQueue.where('status').equals('pending').toArray();
    if (pending.length === 0) return { sent: 0, failed: 0 };

    const batch = pending.slice(0, 100);
    const events = batch.map((e) => ({
      entityType: e.entityType,
      clientId: e.clientId,
      idempotencyKey: e.idempotencyKey,
      payload: e.payload,
    }));

    await api.post('/sync/batch', { events });

    await db.syncQueue.bulkDelete(batch.map((b) => b.id!).filter((id) => id !== undefined));
    return { sent: batch.length, failed: 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    const pending: QueuedEvent[] = await db.syncQueue.where('status').equals('pending').toArray();
    for (const item of pending.slice(0, 100)) {
      const attempts = item.attempts + 1;
      await db.syncQueue.update(item.id!, {
        attempts,
        status: attempts >= 8 ? 'failed' : 'pending',
        lastError: message,
      });
    }
    return { sent: 0, failed: pending.length };
  } finally {
    flushing = false;
  }
}

export function useOnlineSync(): { online: boolean; pending: number; syncing: boolean; syncNow: () => Promise<void> } {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPending = useCallback(async () => {
    setPending(await pendingCount());
  }, []);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    try {
      await flushQueue();
      await refreshPending();
    } finally {
      setSyncing(false);
    }
  }, [refreshPending]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    void refreshPending();

    const interval = window.setInterval(() => {
      if (navigator.onLine) void syncNow();
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(interval);
    };
  }, [refreshPending, syncNow]);

  return { online, pending, syncing, syncNow };
}
