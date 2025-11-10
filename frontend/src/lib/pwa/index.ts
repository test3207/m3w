/**
 * PWA Initialization Module
 * 
 * Coordinates PWA features and offline functionality:
 * - Detects PWA installation
 * - Initializes storage management
 * - Starts metadata sync service
 * - Manages audio caching
 */

import { initializeStorage, getStorageStatus, requestPersistentStorage } from '../storage/quota-manager';
import { startAutoSync, getSyncStatus, manualSync } from '../sync/metadata-sync';
import { isAudioCacheAvailable } from '../storage/audio-cache';

export interface PWAStatus {
  isPWAInstalled: boolean;
  isStoragePersisted: boolean;
  canCacheAudio: boolean;
  syncStatus: {
    lastSyncTime: number | null;
    autoSyncRunning: boolean;
  };
}

/**
 * Initialize PWA features
 */
export async function initializePWA(): Promise<void> {
  console.log('[PWA] Initializing PWA features...');

  // Step 1: Initialize storage management
  await initializeStorage();

  // Step 2: Get current status
  const storageStatus = await getStorageStatus();
  console.log('[PWA] Storage status:', storageStatus);

  // Step 3: Start automatic metadata sync if online
  if (navigator.onLine) {
    console.log('[PWA] Starting metadata sync...');
    startAutoSync();
  } else {
    console.log('[PWA] Offline, skipping metadata sync');
  }

  // Step 4: Check audio caching availability
  const audioCacheAvailable = await isAudioCacheAvailable();
  console.log('[PWA] Audio caching available:', audioCacheAvailable);

  console.log('[PWA] Initialization complete');
}

/**
 * Get comprehensive PWA status
 */
export async function getPWAStatus(): Promise<PWAStatus> {
  const storageStatus = await getStorageStatus();
  const syncStatus = getSyncStatus();
  const canCache = await isAudioCacheAvailable();

  return {
    isPWAInstalled: storageStatus.isPWAInstalled,
    isStoragePersisted: storageStatus.isPersisted,
    canCacheAudio: canCache,
    syncStatus: {
      lastSyncTime: syncStatus.lastSyncTime,
      autoSyncRunning: syncStatus.autoSyncRunning,
    },
  };
}

/**
 * Handle PWA installation event
 * This should be called when the browser's beforeinstallprompt fires
 */
export async function handlePWAInstall(): Promise<void> {
  console.log('[PWA] PWA installation detected');

  // Request persistent storage
  const persisted = await requestPersistentStorage();
  
  if (persisted) {
    console.log('[PWA] Persistent storage granted');
    
    // Trigger initial metadata sync
    if (navigator.onLine) {
      console.log('[PWA] Starting initial metadata sync...');
      await manualSync();
    }
  } else {
    console.warn('[PWA] Persistent storage denied, audio caching unavailable');
  }
}

/**
 * Setup PWA install prompt handler
 */
export function setupPWAInstallPrompt(
  onInstallPrompt?: (event: Event) => void
): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    console.log('[PWA] Install prompt available');
    onInstallPrompt?.(e);
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] PWA installed');
    handlePWAInstall();
  });
}

/**
 * Listen for online/offline events and sync accordingly
 */
export function setupNetworkListeners(): void {
  window.addEventListener('online', () => {
    console.log('[PWA] Network online, starting sync...');
    startAutoSync();
  });

  window.addEventListener('offline', () => {
    console.log('[PWA] Network offline');
  });
}

/**
 * Complete PWA setup (call on app startup)
 */
export async function setupPWA(options?: {
  onInstallPrompt?: (event: Event) => void;
}): Promise<void> {
  console.log('[PWA] Setting up PWA...');

  // Initialize core PWA features
  await initializePWA();

  // Setup event listeners
  setupPWAInstallPrompt(options?.onInstallPrompt);
  setupNetworkListeners();

  console.log('[PWA] Setup complete');
}
