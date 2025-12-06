/**
 * Auth utilities for offline-proxy
 * 
 * Provides cached guest user detection to avoid repeated localStorage parsing.
 * Cache is invalidated on login/logout via invalidateGuestCache().
 */

import { GUEST_USER_ID, isGuestUserId } from "../../constants/guest";

// Re-export for convenience
export { GUEST_USER_ID, isGuestUserId };

// ============================================================
// Guest User Cache
// ============================================================
let guestUserCache: boolean | null = null;

/**
 * Invalidate the guest user cache.
 * Must be called on login/logout to refresh the cached value.
 */
export function invalidateGuestCache(): void {
  guestUserCache = null;
}

/**
 * Get userId from auth store
 * 
 * Reads from Zustand persist storage to get the current user's ID.
 * Throws if not authenticated.
 * 
 * @returns User ID string
 * @throws Error if not authenticated
 */
export function getUserId(): string {
  // Zustand persist uses 'auth-storage' as the key name
  const authState = localStorage.getItem("auth-storage");
  if (!authState) {
    throw new Error("Not authenticated");
  }
  const { user } = JSON.parse(authState).state;
  return user?.id || "";
}

/**
 * Check if current user is a guest (offline-only user)
 * 
 * Uses cached value to avoid repeated localStorage parsing.
 * Cache is invalidated on login/logout.
 * 
 * @returns true if user is guest, false otherwise
 */
export function isGuestUser(): boolean {
  // Return cached value if available
  if (guestUserCache !== null) {
    return guestUserCache;
  }
  
  // Compute and cache
  try {
    const authStore = localStorage.getItem("auth-storage");
    if (!authStore) {
      guestUserCache = false;
      return false;
    }
    const { state } = JSON.parse(authStore);
    guestUserCache = state?.isGuest === true;
    return guestUserCache;
  } catch {
    guestUserCache = false;
    return false;
  }
}
