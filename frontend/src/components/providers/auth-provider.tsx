/**
 * Auth Provider Component
 * Wraps app with automatic token refresh, background metadata sync, and auto-download
 * 
 * Note: These modules are already statically imported elsewhere in the app
 * (router.ts, playerStore, LibraryDetailPage, OfflineSettings), so dynamic imports
 * here would not reduce bundle size. We use static imports for cleaner code.
 */

import { useEffect, useRef } from "react";
import { useAuthRefresh } from "@/hooks/useAuthRefresh";
import { useAuthStore } from "@/stores/authStore";
import {
  isMultiRegionEnabled,
  initializeEndpoint,
} from "@/lib/api/multi-region";
import { startIdlePrefetch, scheduleNormalPriorityTask, scheduleLowPriorityTask } from "@/lib/prefetch";
import { startAutoSync, stopAutoSync } from "@/lib/sync/metadata-sync";
import { triggerAutoDownload } from "@/lib/storage/download-manager";

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // This hook will automatically refresh tokens
  useAuthRefresh();
  
  // Get auth state
  const { isAuthenticated, isGuest } = useAuthStore();
  
  // Track if sync was started for cleanup
  const syncStartedRef = useRef(false);

  // Start idle-time prefetch of heavy modules after initial render
  useEffect(() => {
    startIdlePrefetch();
  }, []);

  // Initialize multi-region endpoint detection on app startup
  // Checks Gateway first, falls back to fastest region if Gateway is down
  // Note: initializeEndpoint() is designed to never throw, handles all errors internally
  useEffect(() => {
    if (isMultiRegionEnabled()) {
      initializeEndpoint();
    }
  }, []);

  // Start metadata sync service for authenticated (non-guest) users
  // This is a PULL-only service - backend is source of truth
  // Triggers: periodic (5min), online event
  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      // Schedule metadata sync as normal priority task
      scheduleNormalPriorityTask("metadata-sync", startAutoSync);
      
      // Schedule auto-download as low priority task
      scheduleLowPriorityTask("auto-download", triggerAutoDownload);
      
      syncStartedRef.current = true;
      
      return () => {
        if (syncStartedRef.current) {
          stopAutoSync();
          syncStartedRef.current = false;
        }
      };
    }
    
    return undefined;
  }, [isAuthenticated, isGuest]);

  return <>{children}</>;
}
