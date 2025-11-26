/**
 * Auth Provider Component
 * Wraps app with automatic token refresh and background sync
 */

import { useEffect } from 'react';
import { useAuthRefresh } from '@/hooks/useAuthRefresh';
import { syncService } from '@/lib/sync/service';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // This hook will automatically refresh tokens
  useAuthRefresh();

  // Start background sync service
  useEffect(() => {
    syncService.start();
    
    return () => {
      // Cleanup on unmount (though this rarely happens)
      syncService.stop();
    };
  }, []);

  return <>{children}</>;
}
