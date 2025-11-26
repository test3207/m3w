/**
 * Service Worker Registration Hook
 * Registers service worker and handles updates
 */

import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { logger } from '@/lib/logger-client';

export function useServiceWorker() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      logger.info('Service Worker registered', { registration: !!r });

      // Check for updates every hour
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      logger.error('Service Worker registration failed', { error });
    },
  });

  useEffect(() => {
    if (offlineReady) {
      logger.info('App ready to work offline');
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
