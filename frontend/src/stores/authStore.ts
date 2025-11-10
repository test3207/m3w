import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_ENDPOINTS } from '@/lib/api-config';

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Unix timestamp
}

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  setAuth: (user: User, tokens: AuthTokens) => void;
  clearAuth: () => void;
  setLoading: (isLoading: boolean) => void;
  refreshAccessToken: () => Promise<boolean>;
  checkAuthStatus: () => Promise<void>;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: true,

      // Actions
      setAuth: (user, tokens) => {
        set({
          user,
          tokens,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      clearAuth: () => {
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      refreshAccessToken: async () => {
        const { tokens } = get();
        if (!tokens?.refreshToken) {
          return false;
        }

        try {
          const response = await fetch(API_ENDPOINTS.auth.refresh, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ refreshToken: tokens.refreshToken }),
          });

          if (!response.ok) {
            console.error('Token refresh failed with status:', response.status);
            get().clearAuth();
            return false;
          }

          const data = await response.json();
          
          if (!data.success || !data.data) {
            console.error('Token refresh response invalid:', data);
            get().clearAuth();
            return false;
          }
          
          set({
            tokens: {
              accessToken: data.data.accessToken,
              refreshToken: data.data.refreshToken || tokens.refreshToken,
              expiresAt: data.data.expiresAt,
            },
          });

          return true;
        } catch (error) {
          console.error('Token refresh failed:', error);
          get().clearAuth();
          return false;
        }
      },

      checkAuthStatus: async () => {
        const { tokens, refreshAccessToken, clearAuth } = get();

        if (!tokens) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        // Check if token is expired
        const now = Date.now();
        const isExpired = tokens.expiresAt <= now;

        if (isExpired) {
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            clearAuth();
            return;
          }
        }

        // Verify token with backend
        try {
          const response = await fetch(API_ENDPOINTS.auth.me, {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
            },
          });

          if (!response.ok) {
            clearAuth();
            return;
          }

          const data = await response.json();
          
          if (!data.success || !data.data) {
            clearAuth();
            return;
          }

          set({ user: data.data, isAuthenticated: true, isLoading: false });
        } catch (error) {
          console.error('Auth check failed:', error);
          clearAuth();
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Convenience hook for auth state
export const useAuth = () => {
  const store = useAuthStore();
  return {
    user: store.user,
    tokens: store.tokens,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    login: store.setAuth,
    logout: store.clearAuth,
    refreshToken: store.refreshAccessToken,
    checkAuth: store.checkAuthStatus,
  };
};
