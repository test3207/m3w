/**
 * PWA Initialization Module
 * 
 * Coordinates PWA features and offline functionality:
 * - Detects PWA installation
 * - Initializes storage management
 * - Starts metadata sync service
 * - Manages audio caching
 */

import { initializeStorage, getStorageStatus, requestPersistentStorage } from "../storage/quota-manager";
import { startAutoSync, getSyncStatus, manualSync } from "../sync/metadata-sync";
import { isAudioCacheAvailable } from "../storage/audio-cache";
import { logger } from "../logger-client";

export interface PWAStatus {
  isPWAInstalled: boolean;
  isStoragePersisted: boolean;
  canCacheAudio: boolean;
  syncStatus: {
    lastSyncTime: number | null;
    autoSyncEnabled: boolean;
    isSyncing: boolean;
  };
}

/**
 * Initialize PWA features
 */
export async function initializePWA(): Promise<void> {
  logger.info("[PWA][initializePWA]", "Initializing PWA features");

  // Step 1: Initialize storage management
  await initializeStorage();

  // Step 2: Get current status
  const storageStatus = await getStorageStatus();
  logger.info("[PWA][initializePWA]", "Storage status", {
    raw: {
      isPWAInstalled: storageStatus.isPWAInstalled,
      isPersisted: storageStatus.isPersisted,
      canCache: storageStatus.canCache,
    },
  });

  // Step 3: Start automatic metadata sync if online
  if (navigator.onLine) {
    logger.info("[PWA][initializePWA]", "Starting metadata sync");
    startAutoSync();
  } else {
    logger.info("[PWA][initializePWA]", "Offline, skipping metadata sync");
  }

  // Step 4: Check audio caching availability
  const audioCacheAvailable = await isAudioCacheAvailable();
  logger.info("[PWA][initializePWA]", "Audio caching status", { raw: { available: audioCacheAvailable } });

  logger.info("[PWA][initializePWA]", "PWA initialization complete");
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
      autoSyncEnabled: syncStatus.autoSyncEnabled,
      isSyncing: syncStatus.isSyncing,
    },
  };
}

/**
 * Handle PWA installation event
 * This should be called when the browser's beforeinstallprompt fires
 */
export async function handlePWAInstall(): Promise<void> {
  logger.info("[PWA][handlePWAInstall]", "PWA installation detected");

  // Request persistent storage
  const persisted = await requestPersistentStorage();

  if (persisted) {
    logger.info("[PWA][handlePWAInstall]", "Persistent storage granted");

    // Trigger initial metadata sync
    if (navigator.onLine) {
      logger.info("[PWA][handlePWAInstall]", "Starting initial metadata sync");
      await manualSync();
    }
  } else {
    logger.warn("[PWA][handlePWAInstall]", "Persistent storage denied, audio caching unavailable");
  }
}

/**
 * Setup PWA install prompt handler
 */
export function setupPWAInstallPrompt(
  onInstallPrompt?: (event: Event) => void
): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    logger.info("[PWA][setupPWAInstallPrompt]", "PWA install prompt available");
    onInstallPrompt?.(e);
  });

  window.addEventListener("appinstalled", () => {
    logger.info("[PWA][setupPWAInstallPrompt]", "PWA installed");
    handlePWAInstall();
  });
}

/**
 * Listen for online/offline events and sync accordingly
 */
export function setupNetworkListeners(): void {
  window.addEventListener("online", () => {
    logger.info("[PWA][setupNetworkListeners]", "Network online, starting sync");
    startAutoSync();
  });

  window.addEventListener("offline", () => {
    logger.info("[PWA][setupNetworkListeners]", "Network offline");
  });
}

/**
 * Complete PWA setup (call on app startup)
 */
export async function setupPWA(options?: {
  onInstallPrompt?: (event: Event) => void;
}): Promise<void> {
  logger.info("[PWA][setupPWA]", "Setting up PWA");

  // Initialize core PWA features
  await initializePWA();

  // Setup event listeners
  setupPWAInstallPrompt(options?.onInstallPrompt);
  setupNetworkListeners();

  logger.info("[PWA][setupPWA]", "PWA setup complete");
}
