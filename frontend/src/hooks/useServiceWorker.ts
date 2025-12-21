/**
 * Service Worker Registration Hook (Singleton)
 * 
 * Registers service worker and handles updates.
 * Uses singleton pattern - SW registration happens once at module load,
 * hook consumers share the same state via external store.
 */

import { useCallback, useSyncExternalStore, useEffect } from "react";
import { registerSW } from "virtual:pwa-register";
import { logger } from "@/lib/logger-client";

// Update check interval: 5 minutes in production, 30 seconds in development
const UPDATE_CHECK_INTERVAL = process.env.NODE_ENV === "development" 
  ? 30 * 1000 
  : 5 * 60 * 1000;

// ============================================================================
// Singleton State Store
// ============================================================================

interface SWState {
  offlineReady: boolean;
  needRefresh: boolean;
  registration: ServiceWorkerRegistration | null;
}

let state: SWState = {
  offlineReady: false,
  needRefresh: false,
  registration: null,
};

const listeners = new Set<() => void>();

function getSnapshot(): SWState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setState(partial: Partial<SWState>) {
  state = { ...state, ...partial };
  listeners.forEach((listener) => listener());
}

// ============================================================================
// Service Worker Registration (runs once at module load)
// ============================================================================

let updateIntervalId: ReturnType<typeof setInterval> | null = null;
let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let initialized = false;

/**
 * Safely check for service worker updates
 * Only attempts update when online, silently ignores failures
 */
function safeUpdateCheck() {
  if (!navigator.onLine) {
    logger.debug("Skipping SW update check - offline");
    return;
  }
  
  state.registration?.update().catch(() => {
    // Silently ignore - network issues are expected
  });
}

function initServiceWorker() {
  if (initialized) return;
  initialized = true;

  updateSW = registerSW({
    onRegistered(r) {
      logger.info("Service Worker registered", { registration: !!r });

      if (r) {
        setState({ registration: r });
        
        // Check for updates immediately
        safeUpdateCheck();
        
        // Periodic update checks
        if (updateIntervalId) clearInterval(updateIntervalId);
        updateIntervalId = setInterval(() => {
          logger.debug("Periodic SW update check...");
          safeUpdateCheck();
        }, UPDATE_CHECK_INTERVAL);
      }
    },
    onNeedRefresh() {
      logger.info("New version available! Prompting user to refresh.");
      setState({ needRefresh: true });
    },
    onOfflineReady() {
      logger.info("App is ready to work offline");
      setState({ offlineReady: true });
    },
    onRegisterError(error) {
      logger.error("Service Worker registration failed", { error });
    },
  });

  // Check for updates when tab becomes visible
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      logger.debug("Tab became visible, checking for updates...");
      safeUpdateCheck();
    }
  });
}

// Initialize on module load (browser only)
if (typeof window !== "undefined") {
  initServiceWorker();
}

// ============================================================================
// React Hook
// ============================================================================

export function useServiceWorker() {
  const { offlineReady, needRefresh } = useSyncExternalStore(subscribe, getSnapshot);

  // HMR cleanup: re-initialize if needed
  useEffect(() => {
    if (!initialized) {
      initServiceWorker();
    }
  }, []);

  const close = useCallback(() => {
    setState({ offlineReady: false, needRefresh: false });
  }, []);

  const updateServiceWorker = useCallback(async (reloadPage = true) => {
    if (updateSW) {
      await updateSW(reloadPage);
    }
  }, []);

  return {
    offlineReady,
    needRefresh,
    updateServiceWorker,
    close,
  };
}
