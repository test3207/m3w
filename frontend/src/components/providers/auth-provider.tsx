/**
 * Auth Provider Component
 * Wraps app with automatic token refresh and background sync
 */

import { useEffect } from 'react';
import { useAuthRefresh } from '@/hooks/useAuthRefresh';
import { syncService } from '@/lib/sync/service';
import { useAuthStore } from '@/stores/authStore';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // This hook will automatically refresh tokens
  useAuthRefresh();
  
  // Get auth state
  const { isAuthenticated, isGuest } = useAuthStore();

  // Start unified sync service for authenticated (non-guest) users
  // SyncService handles both PUSH (local changes) and PULL (server state)
  // Triggers: periodic (5min), online event, visibility change
  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      syncService.start();
    }
    
    return () => {
      syncService.stop();
    };
  }, [isAuthenticated, isGuest]);

  return <>{children}</>;
}
