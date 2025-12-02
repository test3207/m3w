import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/services';
import { logger } from '@/lib/logger-client';
import { saveTokenToIndexedDB, clearTokenFromIndexedDB } from '@/lib/auth/token-storage';
import { GUEST_USER_ID } from '@/lib/constants/guest';
import type { AuthTokens } from '@m3w/shared';
import type { User as ApiUser } from '@/services/api/main/resources/auth';

export type User = ApiUser & {
  image?: string | null;
};

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
}

interface AuthActions {
  setAuth: (user: User, tokens: AuthTokens) => void;
  loginAsGuest: () => void;
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
      isGuest: false,
      isLoading: true,

      // Actions
      setAuth: (user, tokens) => {
        // Sync access token to IndexedDB for Service Worker
        saveTokenToIndexedDB(tokens.accessToken).catch((error) => {
          logger.error('Failed to sync token to IndexedDB', { error });
        });

        set({
          user,
          tokens,
          isAuthenticated: true,
          isGuest: false,
          isLoading: false,
        });
      },

      loginAsGuest: () => {
        set({
          user: {
            id: GUEST_USER_ID,
            name: 'Guest User',
            email: 'guest@local',
            image: null,
            createdAt: new Date().toISOString(),
          },
          tokens: {
            accessToken: 'guest-token',
            refreshToken: 'guest-refresh-token',
            expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365, // 1 year
          },
          isAuthenticated: true,
          isGuest: true,
          isLoading: false,
        });
      },

      clearAuth: () => {
        // Clear token from IndexedDB
        clearTokenFromIndexedDB().catch((error) => {
          logger.error('Failed to clear token from IndexedDB', { error });
        });

        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isGuest: false,
          isLoading: false,
        });
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      refreshAccessToken: async () => {
        const { tokens, isGuest } = get();
        if (!tokens?.refreshToken) {
          return false;
        }

        // Guest tokens don't need refresh
        if (isGuest) {
          return true;
        }

        try {
          const data = await api.main.auth.refreshToken(tokens.refreshToken);

          const newTokens = {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken || tokens.refreshToken,
            expiresAt: data.expiresAt,
          };

          // Sync new token to IndexedDB
          await saveTokenToIndexedDB(newTokens.accessToken);

          set({ tokens: newTokens });

          return true;
        } catch (error) {
          logger.error('Token refresh failed', { error });
          get().clearAuth();
          return false;
        }
      },

      checkAuthStatus: async () => {
        const { tokens, refreshAccessToken, clearAuth, isGuest } = get();

        if (!tokens) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        // Skip backend check for guest users
        if (isGuest) {
          set({ isLoading: false, isAuthenticated: true });
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
          const user = await api.main.auth.getMe();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error) {
          logger.error('Auth check failed', { error });
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
        isGuest: state.isGuest,
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
