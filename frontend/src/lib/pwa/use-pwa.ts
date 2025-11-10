/**
 * PWA Registration Hook
 * Registers service worker and handles updates
 */

import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePWA() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
      
      // Check for updates every hour
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      console.log('App ready to work offline');
    }
  }, [offlineReady]);

  return {
    offlineReady,
    needRefresh,
    updateServiceWorker,
    close: () => {
      setOfflineReady(false);
      setNeedRefresh(false);
    },
  };
}
