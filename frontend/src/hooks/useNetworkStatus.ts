/**
 * Network Status Hook
 * Monitors online/offline status and sync queue
 * Combines browser network status with API connectivity
 */

import { useState, useEffect } from 'react';
import { getSyncQueueSize } from '../lib/db/schema';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isApiReachable, setIsApiReachable] = useState(true);
  const [pendingSyncs, setPendingSyncs] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Listen for API connectivity events
    const handleApiError = () => setIsApiReachable(false);
    const handleApiSuccess = () => setIsApiReachable(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('api-error', handleApiError);
    window.addEventListener('api-success', handleApiSuccess);

    // Check sync queue size periodically
    const checkSyncQueue = async () => {
      const count = await getSyncQueueSize();
      setPendingSyncs(count);
    };

    checkSyncQueue();
    const interval = setInterval(checkSyncQueue, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('api-error', handleApiError);
      window.removeEventListener('api-success', handleApiSuccess);
      clearInterval(interval);
    };
  }, []);

  const effectiveOnline = isOnline && isApiReachable;

  return {
    isOnline: effectiveOnline,
    pendingSyncs,
    isOfflineMode: !effectiveOnline || pendingSyncs > 0,
  };
}
