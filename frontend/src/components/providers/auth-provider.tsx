/**
 * Auth Provider Component
 * Wraps app with automatic token refresh, metadata sync, and background sync
 */

import { useEffect } from 'react';
import { useAuthRefresh } from '@/hooks/useAuthRefresh';
import { syncService } from '@/lib/sync/service';
import { startAutoSync, stopAutoSync } from '@/lib/sync/metadata-sync';
import { useAuthStore } from '@/stores/authStore';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // This hook will automatically refresh tokens
  useAuthRefresh();
  
  // Get auth state
  const { isAuthenticated, isGuest } = useAuthStore();

  // Start metadata auto-sync for authenticated (non-guest) users
  // Network status is managed internally by metadata-sync service
  useEffect(() => {
    // Only sync metadata for authenticated users who are not guests
    // Guest users have local-only data in IndexedDB
    if (isAuthenticated && !isGuest) {
      startAutoSync();
    }
    
    return () => {
      stopAutoSync();
    };
  }, [isAuthenticated, isGuest]);

  // Start background sync service (queue replay)
  useEffect(() => {
    syncService.start();
    
    return () => {
      // Cleanup on unmount (though this rarely happens)
      syncService.stop();
    };
  }, []);

  return <>{children}</>;
}
