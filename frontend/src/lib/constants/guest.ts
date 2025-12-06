/**
 * Guest Mode Constants
 * 
 * Fixed identifiers for offline/guest mode users.
 * Using UUID format for consistency with authenticated user IDs.
 */

/**
 * Fixed UUID for guest user
 * This ensures all guest data uses the same userId across sessions.
 */
export const GUEST_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Check if a userId is the guest user
 */
export function isGuestUserId(userId: string): boolean {
  return userId === GUEST_USER_ID;
}
