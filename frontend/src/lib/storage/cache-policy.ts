/**
 * Cache Policy - Simplified
 * 
 * Controls auto-download behavior for audio files:
 * - Off: No automatic downloads
 * - WiFi Only: Auto-download when on WiFi
 * - Always: Auto-download on any network
 * 
 * Note: Cache-on-Play, Cache-on-Upload, and Manual Download
 * always work regardless of this setting.
 */

import { db, type AutoDownloadSetting } from "../db/schema";
import { logger } from "../logger-client";

// Local setting key
const AUTO_DOWNLOAD_KEY = "autoDownload";

/**
 * Get auto-download setting
 * @returns Current setting (defaults to "wifi-only")
 */
export async function getAutoDownloadSetting(): Promise<AutoDownloadSetting> {
  try {
    const setting = await db.localSettings.get(AUTO_DOWNLOAD_KEY);
    if (!setting) return "wifi-only"; // Default
    return setting.value as AutoDownloadSetting;
  } catch (error) {
    logger.error("[CachePolicy][getAutoDownloadSetting]", "Failed to get auto-download setting", error);
    return "wifi-only";
  }
}

/**
 * Set auto-download setting
 */
export async function setAutoDownloadSetting(value: AutoDownloadSetting): Promise<void> {
  try {
    await db.localSettings.put({
      key: AUTO_DOWNLOAD_KEY,
      value,
      updatedAt: new Date(),
    });
  } catch (error) {
    logger.error("[CachePolicy][setAutoDownloadSetting]", "Failed to set auto-download setting", error);
  }
}

/**
 * Check if auto-download is allowed based on setting and network status
 * Used for background auto-download on app startup.
 * 
 * @returns true if auto-download should proceed
 */
export async function canAutoDownload(): Promise<boolean> {
  const setting = await getAutoDownloadSetting();
  
  logger.debug("[CachePolicy][canAutoDownload]", `setting=${setting}, online=${navigator.onLine}`);
  
  // Off: never auto-download
  if (setting === "off") {
    return false;
  }
  
  // Always: download on any network
  if (setting === "always") {
    return navigator.onLine;
  }
  
  // WiFi-only: check connection type
  if ("connection" in navigator) {
    const connection = (navigator as Navigator & { connection?: { type?: string; effectiveType?: string } }).connection;
    logger.debug("[CachePolicy][canAutoDownload]", `connection type=${connection?.type}, effectiveType=${connection?.effectiveType}`);
    
    // Allow wifi, ethernet
    if (connection?.type === "wifi" || connection?.type === "ethernet") {
      return true;
    }
    // Block cellular
    if (connection?.type === "cellular") {
      return false;
    }
  }
  
  // Desktop browsers often don't have connection.type
  // Default to allow if online (assuming desktop = good connection)
  logger.debug("[CachePolicy][canAutoDownload]", "connection type unknown, defaulting to allow");
  return navigator.onLine;
}
