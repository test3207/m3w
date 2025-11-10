/**
 * Storage Quota Manager
 * 
 * Manages PWA persistent storage quota:
 * - Detects PWA installation status
 * - Requests persistent storage permission
 * - Monitors quota usage
 * - Provides UI for storage management
 */

/**
 * Check if app is running as PWA (installed)
 */
export function isPWAInstalled(): boolean {
  // Check if running in standalone mode (iOS Safari)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  // Check if running in standalone mode (Android Chrome)
  const isStandaloneNavigator = ('standalone' in window.navigator) && (window.navigator as { standalone?: boolean }).standalone;
  
  // Check if launched from home screen
  const isLaunchedFromHomeScreen = window.matchMedia('(display-mode: standalone)').matches ||
                                     window.matchMedia('(display-mode: fullscreen)').matches ||
                                     window.matchMedia('(display-mode: minimal-ui)').matches;
  
  return isStandalone || isStandaloneNavigator || isLaunchedFromHomeScreen;
}

/**
 * Check if persistent storage is supported
 */
export function isStorageSupported(): boolean {
  return 'storage' in navigator && 'persist' in navigator.storage;
}

/**
 * Request persistent storage permission
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!isStorageSupported()) {
    console.warn('[StorageManager] Storage API not supported');
    return false;
  }

  try {
    const isPersisted = await navigator.storage.persist();
    console.log(`[StorageManager] Persistent storage ${isPersisted ? 'granted' : 'denied'}`);
    return isPersisted;
  } catch (error) {
    console.error('[StorageManager] Failed to request persistent storage:', error);
    return false;
  }
}

/**
 * Check if storage is already persisted
 */
export async function isStoragePersisted(): Promise<boolean> {
  if (!isStorageSupported()) {
    return false;
  }

  try {
    return await navigator.storage.persisted();
  } catch (error) {
    console.error('[StorageManager] Failed to check storage persistence:', error);
    return false;
  }
}

export interface StorageQuota {
  usage: number;
  quota: number;
  usagePercent: number;
  usageFormatted: string;
  quotaFormatted: string;
  availableFormatted: string;
}

/**
 * Get storage quota information
 */
export async function getStorageQuota(): Promise<StorageQuota | null> {
  if (!isStorageSupported()) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;

    return {
      usage,
      quota,
      usagePercent: quota > 0 ? (usage / quota) * 100 : 0,
      usageFormatted: formatBytes(usage),
      quotaFormatted: formatBytes(quota),
      availableFormatted: formatBytes(quota - usage),
    };
  } catch (error) {
    console.error('[StorageManager] Failed to get storage quota:', error);
    return null;
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const decimals = 2;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${value.toFixed(decimals)} ${sizes[i]}`;
}

/**
 * Check if there's enough quota for caching
 * @param requiredBytes Minimum bytes required
 */
export async function hasEnoughQuota(requiredBytes: number): Promise<boolean> {
  const quota = await getStorageQuota();
  if (!quota) return false;

  const available = quota.quota - quota.usage;
  return available >= requiredBytes;
}

/**
 * Get available quota in bytes
 */
export async function getAvailableQuota(): Promise<number> {
  const quota = await getStorageQuota();
  if (!quota) return 0;

  return quota.quota - quota.usage;
}

export interface StorageStatus {
  isPWAInstalled: boolean;
  isStorageSupported: boolean;
  isPersisted: boolean;
  quota: StorageQuota | null;
  canCache: boolean;
}

/**
 * Get comprehensive storage status
 */
export async function getStorageStatus(): Promise<StorageStatus> {
  const pwaInstalled = isPWAInstalled();
  const storageSupported = isStorageSupported();
  const persisted = await isStoragePersisted();
  const quota = await getStorageQuota();

  // Can cache if PWA is installed AND storage is persisted AND there's available quota
  const canCache = pwaInstalled && persisted && (quota ? quota.quota - quota.usage > 0 : false);

  return {
    isPWAInstalled: pwaInstalled,
    isStorageSupported: storageSupported,
    isPersisted: persisted,
    quota,
    canCache,
  };
}

/**
 * Initialize storage management (call on PWA install)
 */
export async function initializeStorage(): Promise<void> {
  console.log('[StorageManager] Initializing storage management...');

  const status = await getStorageStatus();

  console.log('[StorageManager] Storage status:', {
    isPWAInstalled: status.isPWAInstalled,
    isPersisted: status.isPersisted,
    quota: status.quota,
  });

  // If PWA is installed but storage not persisted, request it
  if (status.isPWAInstalled && !status.isPersisted) {
    console.log('[StorageManager] Requesting persistent storage...');
    const granted = await requestPersistentStorage();
    
    if (granted) {
      console.log('[StorageManager] Persistent storage granted');
    } else {
      console.warn('[StorageManager] Persistent storage denied');
    }
  }
}

/**
 * Monitor storage quota changes
 */
export function monitorStorageQuota(
  callback: (quota: StorageQuota | null) => void,
  intervalMs: number = 30000 // 30 seconds
): () => void {
  const intervalId = setInterval(async () => {
    const quota = await getStorageQuota();
    callback(quota);
  }, intervalMs);

  // Initial call
  getStorageQuota().then(callback);

  // Return cleanup function
  return () => clearInterval(intervalId);
}
