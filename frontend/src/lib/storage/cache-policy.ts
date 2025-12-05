/**
 * Cache Policy Decision Logic
 * 
 * 4-layer configuration hierarchy (highest to lowest priority):
 * 1. Local library override (localCacheOverride in OfflineLibrary)
 * 2. Local global override (LocalSetting: cacheAllOverride)
 * 3. Backend library setting (cacheOverride from Library API)
 * 4. Backend user global (cacheAllEnabled from UserPreferences API)
 */

import { db, type LocalCacheOverride, type DownloadTiming } from '../db/schema';
import type { Library, UserPreferences, CacheOverride } from '@m3w/shared';
import { logger } from '../logger-client';

// Local setting keys
const CACHE_ALL_OVERRIDE_KEY = 'cacheAllOverride';
const DOWNLOAD_TIMING_KEY = 'downloadTiming';

// ============================================================
// Local Settings Helpers
// ============================================================

/**
 * Get local global cache override setting
 */
export async function getLocalCacheAllOverride(): Promise<LocalCacheOverride | null> {
  try {
    const setting = await db.localSettings.get(CACHE_ALL_OVERRIDE_KEY);
    if (!setting) return null;
    return setting.value as LocalCacheOverride;
  } catch (error) {
    logger.error('Failed to get local cache override', error);
    return null;
  }
}

/**
 * Set local global cache override setting
 */
export async function setLocalCacheAllOverride(value: LocalCacheOverride | null): Promise<void> {
  try {
    if (value === null) {
      await db.localSettings.delete(CACHE_ALL_OVERRIDE_KEY);
    } else {
      await db.localSettings.put({
        key: CACHE_ALL_OVERRIDE_KEY,
        value,
        updatedAt: new Date(),
      });
    }
  } catch (error) {
    logger.error('Failed to set local cache override', error);
  }
}

/**
 * Get download timing preference
 */
export async function getDownloadTiming(): Promise<DownloadTiming> {
  try {
    const setting = await db.localSettings.get(DOWNLOAD_TIMING_KEY);
    if (!setting) return 'wifi-only'; // Default
    return setting.value as DownloadTiming;
  } catch (error) {
    logger.error('Failed to get download timing', error);
    return 'wifi-only';
  }
}

/**
 * Set download timing preference
 */
export async function setDownloadTiming(value: DownloadTiming): Promise<void> {
  try {
    await db.localSettings.put({
      key: DOWNLOAD_TIMING_KEY,
      value,
      updatedAt: new Date(),
    });
  } catch (error) {
    logger.error('Failed to set download timing', error);
  }
}

// ============================================================
// Library-level Local Override
// ============================================================

/**
 * Get local cache override for a specific library
 */
export async function getLibraryLocalOverride(libraryId: string): Promise<LocalCacheOverride | undefined> {
  try {
    const library = await db.libraries.get(libraryId);
    return library?.localCacheOverride;
  } catch (error) {
    logger.error('Failed to get library local override', error);
    return undefined;
  }
}

/**
 * Set local cache override for a specific library
 */
export async function setLibraryLocalOverride(
  libraryId: string, 
  value: LocalCacheOverride | undefined
): Promise<void> {
  try {
    await db.libraries.update(libraryId, { localCacheOverride: value });
  } catch (error) {
    logger.error('Failed to set library local override', error);
  }
}

// ============================================================
// Cache Decision Logic
// ============================================================

export interface CachePolicyContext {
  /** Backend user preferences (null if offline or guest) */
  userPreferences: UserPreferences | null;
  /** Backend library data (from API response) */
  backendLibrary: Library | null;
}

/**
 * Determine if a library should be cached based on 4-layer hierarchy
 * 
 * Priority (highest to lowest):
 * 1. Local library override (localCacheOverride)
 * 2. Local global override (LocalSetting: cacheAllOverride)
 * 3. Backend library setting (Library.cacheOverride)
 * 4. Backend user global (UserPreferences.cacheAllEnabled)
 */
export async function shouldCacheLibrary(
  libraryId: string,
  context: CachePolicyContext
): Promise<boolean> {
  // 1. Check local library override
  const localLibraryOverride = await getLibraryLocalOverride(libraryId);
  if (localLibraryOverride === 'always') return true;
  if (localLibraryOverride === 'never') return false;
  // 'inherit' or undefined → continue to next level

  // 2. Check local global override
  const localGlobalOverride = await getLocalCacheAllOverride();
  if (localGlobalOverride === 'always') return true;
  if (localGlobalOverride === 'never') return false;
  // 'inherit' or null → continue to next level

  // 3. Check backend library setting
  const backendLibraryOverride = context.backendLibrary?.cacheOverride;
  if (backendLibraryOverride === 'always') return true;
  if (backendLibraryOverride === 'never') return false;
  // 'inherit' or undefined → continue to next level

  // 4. Check backend user global
  return context.userPreferences?.cacheAllEnabled ?? false;
}

/**
 * Get the effective cache policy for a library (for display purposes)
 * Returns which level determined the policy
 */
export async function getEffectiveCachePolicy(
  libraryId: string,
  context: CachePolicyContext
): Promise<{
  shouldCache: boolean;
  source: 'local-library' | 'local-global' | 'backend-library' | 'backend-global';
  value: CacheOverride | boolean;
}> {
  // 1. Local library override
  const localLibraryOverride = await getLibraryLocalOverride(libraryId);
  if (localLibraryOverride && localLibraryOverride !== 'inherit') {
    return {
      shouldCache: localLibraryOverride === 'always',
      source: 'local-library',
      value: localLibraryOverride,
    };
  }

  // 2. Local global override
  const localGlobalOverride = await getLocalCacheAllOverride();
  if (localGlobalOverride && localGlobalOverride !== 'inherit') {
    return {
      shouldCache: localGlobalOverride === 'always',
      source: 'local-global',
      value: localGlobalOverride,
    };
  }

  // 3. Backend library setting
  const backendLibraryOverride = context.backendLibrary?.cacheOverride;
  if (backendLibraryOverride && backendLibraryOverride !== 'inherit') {
    return {
      shouldCache: backendLibraryOverride === 'always',
      source: 'backend-library',
      value: backendLibraryOverride,
    };
  }

  // 4. Backend user global
  const shouldCache = context.userPreferences?.cacheAllEnabled ?? false;
  return {
    shouldCache,
    source: 'backend-global',
    value: shouldCache,
  };
}

/**
 * Check if download is allowed based on timing preference and network status
 */
export async function canDownloadNow(): Promise<boolean> {
  const timing = await getDownloadTiming();
  
  if (timing === 'manual') return false;
  if (timing === 'always') return true;
  
  // wifi-only: check connection type
  if ('connection' in navigator) {
    const connection = (navigator as Navigator & { connection?: { type?: string; effectiveType?: string } }).connection;
    // Consider wifi, ethernet as allowed; cellular as not
    if (connection?.type === 'wifi' || connection?.type === 'ethernet') {
      return true;
    }
    // If type not available, check effectiveType (4g might be wifi)
    // Be conservative: only allow if we're sure it's not cellular
    if (connection?.type === 'cellular') {
      return false;
    }
  }
  
  // If we can't determine, default to allowing (user chose wifi-only, assume they know)
  return navigator.onLine;
}
