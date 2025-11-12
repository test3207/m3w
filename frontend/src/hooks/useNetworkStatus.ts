/**
 * Network Status Hook
 * Monitors online/offline status and sync queue
 */

import { useState, useEffect } from 'react';
import { getSyncQueueSize } from '../lib/db/schema';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check sync queue size periodically
    const checkSyncQueue = async () => {
      const count = await getSyncQueueSize();
      setPendingSyncs(count);
    };

    checkSyncQueue();
    const interval = setInterval(checkSyncQueue, 5000); // Check every 5 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return {
    isOnline,
    pendingSyncs,
    isOfflineMode: !isOnline || pendingSyncs > 0,
  };
}
