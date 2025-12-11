/**
 * Network Status Hook
 * Monitors online/offline status for UI feedback
 * Combines browser network status with API connectivity
 */

import { useState, useEffect } from "react";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isApiReachable, setIsApiReachable] = useState(true);

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

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("api-error", handleApiError);
    window.addEventListener("api-success", handleApiSuccess);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("api-error", handleApiError);
      window.removeEventListener("api-success", handleApiSuccess);
    };
  }, []);

  const effectiveOnline = isOnline && isApiReachable;

  return {
    isOnline: effectiveOnline,
    // Simplified: No sync queue in new architecture
    // Auth users: backend is source of truth, offline is read-only
    // Guest users: full local CRUD, no sync needed
    isOfflineMode: !effectiveOnline,
  };
}
