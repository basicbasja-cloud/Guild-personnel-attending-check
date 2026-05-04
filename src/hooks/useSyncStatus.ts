import { useState, useEffect } from 'react';
import { syncEngine, type SyncStatus } from '../lib/syncEngine';

export interface SyncStatusInfo {
  status: SyncStatus;
  isLive: boolean;
  pendingCount: number;
}

export function useSyncStatus(): SyncStatusInfo {
  const [status, setStatus] = useState<SyncStatus>(() => syncEngine.getStatus());
  const [isLive, setIsLive] = useState(() => syncEngine.getLive());
  const [pendingCount, setPendingCount] = useState(() => syncEngine.getPendingCount());

  useEffect(() => {
    const u1 = syncEngine.onStatus(setStatus);
    const u2 = syncEngine.onLive(setIsLive);
    const u3 = syncEngine.onPending(setPendingCount);
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  return { status, isLive, pendingCount };
}
