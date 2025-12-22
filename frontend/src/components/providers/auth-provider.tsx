/**
 * Auth Provider Component
 * Wraps app with automatic token refresh, background metadata sync, and auto-download
 */

import { useEffect } from "react";
import { useAuthRefresh } from "@/hooks/useAuthRefresh";
import { startAutoSync, stopAutoSync } from "@/lib/sync/metadata-sync";
import { triggerAutoDownload } from "@/lib/storage/download-manager";
import { useAuthStore } from "@/stores/authStore";
import { initializeEndpoint, isMultiRegionEnabled } from "@/lib/api/multi-region";
import { startIdlePrefetch, scheduleLowPriorityTask, scheduleNormalPriorityTask } from "@/lib/prefetch";

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // This hook will automatically refresh tokens
  useAuthRefresh();
  
  // Get auth state
  const { isAuthenticated, isGuest } = useAuthStore();

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
      // Uses unified idle scheduler - executes 8s+ after load
      scheduleNormalPriorityTask("metadata-sync", startAutoSync);
      
      // Schedule auto-download as low priority task
      // Uses unified idle scheduler - executes 15s+ after load to avoid Lighthouse impact
      scheduleLowPriorityTask("auto-download", triggerAutoDownload);
      
      return () => {
        stopAutoSync();
      };
    }
    
    return () => {
      stopAutoSync();
    };
  }, [isAuthenticated, isGuest]);

  return <>{children}</>;
}
