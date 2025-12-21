/**
 * Service Worker Registration Hook
 * Registers service worker and handles updates
 */

import { useEffect, useCallback } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { logger } from "@/lib/logger-client";

// Update check interval: 5 minutes in production, 30 seconds in development
const UPDATE_CHECK_INTERVAL = process.env.NODE_ENV === "development" 
  ? 30 * 1000 
  : 5 * 60 * 1000;

export function useServiceWorker() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      logger.info("Service Worker registered", { registration: !!r });

      if (r) {
        // Check for updates immediately on registration
        r.update();
        
        // Then check periodically
        setInterval(() => {
          logger.debug("Checking for service worker updates...");
          r.update();
        }, UPDATE_CHECK_INTERVAL);
      }
    },
    onNeedRefresh() {
      // This callback is triggered when a new service worker is available
      // The needRefresh state is automatically set to true by useRegisterSW
      logger.info("New version available! Prompting user to refresh.");
    },
    onOfflineReady() {
      logger.info("App is ready to work offline");
    },
    onRegisterError(error) {
      logger.error("Service Worker registration failed", { error });
    },
  });

  // Check for updates when tab becomes visible (user returns to app)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        logger.debug("Tab became visible, checking for updates...");
        // Trigger update check by re-registering
        navigator.serviceWorker?.getRegistration().then((registration) => {
          registration?.update();
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const close = useCallback(() => {
    setOfflineReady(false);
    setNeedRefresh(false);
  }, [setOfflineReady, setNeedRefresh]);

  return {
    offlineReady,
    needRefresh,
    updateServiceWorker,
    close,
  };
}
