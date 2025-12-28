/**
 * Player Store HMR (Hot Module Replacement) Support
 * 
 * During development, Vite's HMR will re-execute this module when changes occur.
 * We use window globals to preserve state and prevent duplicate setup:
 * - __PLAYER_STATE_BACKUP__: Stores player state to restore after HMR
 * - __PLAYER_STORE_LISTENERS_REGISTERED__: Prevents duplicate event listeners
 * - __PLAYER_STORE_INTERVAL_ID__: Tracks sync interval to prevent accumulation
 * - __PLAYER_STORE_VISIBILITY_HANDLER__: Tracks visibility change handler
 */

import type { PlayerState } from "./types";

declare global {
  interface Window {
    __PLAYER_STATE_BACKUP__?: PlayerState;
    __PLAYER_STORE_LISTENERS_REGISTERED__?: boolean;
    __PLAYER_STORE_INTERVAL_ID__?: ReturnType<typeof setInterval>;
    __PLAYER_STORE_VISIBILITY_HANDLER__?: () => void;
  }
}

/**
 * Get backed up player state (used during HMR).
 */
export function getBackupState(): PlayerState | null {
  return window.__PLAYER_STATE_BACKUP__ || null;
}

/**
 * Back up player state (used before HMR).
 */
export function setBackupState(state: PlayerState): void {
  window.__PLAYER_STATE_BACKUP__ = state;
}

/**
 * Check if store listeners have been registered.
 */
export function isListenersRegistered(): boolean {
  return window.__PLAYER_STORE_LISTENERS_REGISTERED__ === true;
}

/**
 * Mark listeners as registered.
 */
export function markListenersRegistered(): void {
  window.__PLAYER_STORE_LISTENERS_REGISTERED__ = true;
}

/**
 * Get the current sync interval ID.
 */
export function getSyncIntervalId(): ReturnType<typeof setInterval> | undefined {
  return window.__PLAYER_STORE_INTERVAL_ID__;
}

/**
 * Set the sync interval ID.
 */
export function setSyncIntervalId(id: ReturnType<typeof setInterval>): void {
  window.__PLAYER_STORE_INTERVAL_ID__ = id;
}

/**
 * Clear any existing sync interval.
 */
export function clearSyncInterval(): void {
  if (window.__PLAYER_STORE_INTERVAL_ID__) {
    clearInterval(window.__PLAYER_STORE_INTERVAL_ID__);
    window.__PLAYER_STORE_INTERVAL_ID__ = undefined;
  }
}

/**
 * Set visibility change handler.
 */
export function setVisibilityHandler(handler: () => void): void {
  clearVisibilityHandler();
  window.__PLAYER_STORE_VISIBILITY_HANDLER__ = handler;
  document.addEventListener("visibilitychange", handler);
}

/**
 * Clear visibility change handler.
 */
export function clearVisibilityHandler(): void {
  if (window.__PLAYER_STORE_VISIBILITY_HANDLER__) {
    document.removeEventListener("visibilitychange", window.__PLAYER_STORE_VISIBILITY_HANDLER__);
    window.__PLAYER_STORE_VISIBILITY_HANDLER__ = undefined;
  }
}
