/**
 * Auth Provider Component
 * Wraps app with automatic token refresh
 */

import { useAuthRefresh } from '@/hooks/useAuthRefresh';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // This hook will automatically refresh tokens
  useAuthRefresh();

  return <>{children}</>;
}
