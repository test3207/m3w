/**
 * Storage-related constants
 * 
 * Centralized configuration for storage estimation and cache management
 */

// ============================================================
// Storage Size Estimates
// ============================================================

/** Average audio file size (5MB per song) */
export const AVG_AUDIO_SIZE = 5 * 1024 * 1024; // 5 MB

/** Average cover art size (100KB per cover) */
export const AVG_COVER_SIZE = 100 * 1024; // 100 KB

/** Average song metadata size in IndexedDB (10KB per song) */
export const AVG_METADATA_SIZE = 10 * 1024; // 10 KB

// ============================================================
// Storage Warning Thresholds
// ============================================================

/** Critical warning threshold (90% usage) */
export const CRITICAL_THRESHOLD = 90;

/** Warning threshold (80% usage) */
export const WARNING_THRESHOLD = 80;

// ============================================================
// Cache Sync Configuration
// ============================================================

/** Cache sync interval (5 minutes) */
export const CACHE_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

/** Batch size for cache sync operations */
export const CACHE_SYNC_BATCH_SIZE = 50;

/** Cache expiry time (60 seconds for cache validation) */
export const CACHE_EXPIRY_TIME = 60 * 1000; // 60 seconds

// ============================================================
// Metadata Sync Configuration
// ============================================================

/** Metadata sync interval (5 minutes) */
export const METADATA_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
