/**
 * Network Status Hook
 * Monitors online/offline status and sync queue
 * Combines browser network status with API connectivity
 */

import { useState, useEffect } from 'react';
import { getDirtyCount } from '../lib/db/schema';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isApiReachable, setIsApiReachable] = useState(true);
  const [pendingSyncs, setPendingSyncs] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // When browser goes online, optimistically assume API is reachable.
      // NOTE: This may cause a brief UI inconsistency if the API is still unreachable (e.g., server down but network up).
      // The next API call will correct isApiReachable via 'api-error'/'api-success' events.
      setIsApiReachable(true);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setIsApiReachable(false);
    };

    // Listen for API connectivity events
    const handleApiError = () => setIsApiReachable(false);
    const handleApiSuccess = () => setIsApiReachable(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('api-error', handleApiError);
    window.addEventListener('api-success', handleApiSuccess);

    // Check dirty entity count periodically
    const checkDirtyEntities = async () => {
      const count = await getDirtyCount();
      setPendingSyncs(count);
    };

    checkDirtyEntities();
    const interval = setInterval(checkDirtyEntities, 5000);

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
