/**
 * Auth utilities for offline-proxy
 */

import { GUEST_USER_ID, isGuestUserId } from '../../constants/guest';

// Re-export for convenience
export { GUEST_USER_ID, isGuestUserId };

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
  const authState = localStorage.getItem('auth-storage');
  if (!authState) {
    throw new Error('Not authenticated');
  }
  const { user } = JSON.parse(authState).state;
  return user?.id || '';
}

/**
 * Check if current user is a guest (offline-only user)
 * 
 * @returns true if user is guest, false otherwise
 */
export function isGuestUser(): boolean {
  try {
    return isGuestUserId(getUserId());
  } catch {
    return false;
  }
}
