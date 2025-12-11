/**
 * Auth Provider Component
 * Wraps app with automatic token refresh, background metadata sync, and auto-download
 */

import { useEffect } from "react";
import { useAuthRefresh } from "@/hooks/useAuthRefresh";
import { startAutoSync, stopAutoSync } from "@/lib/sync/metadata-sync";
import { triggerAutoDownload } from "@/lib/storage/download-manager";
import { useAuthStore } from "@/stores/authStore";

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // This hook will automatically refresh tokens
  useAuthRefresh();
  
  // Get auth state
  const { isAuthenticated, isGuest } = useAuthStore();

  // Start metadata sync service for authenticated (non-guest) users
  // This is a PULL-only service - backend is source of truth
  // Triggers: periodic (5min), online event
  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      startAutoSync();
      
      // Trigger auto-download for audio files on app startup
      // This respects the user's auto-download setting (off/wifi-only/always)
      triggerAutoDownload();
    }
    
    return () => {
      stopAutoSync();
    };
  }, [isAuthenticated, isGuest]);

  return <>{children}</>;
}
