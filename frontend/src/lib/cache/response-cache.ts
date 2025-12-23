/**
 * Response Cache
 * 
 * Caches GET API responses to IndexedDB based on route configuration.
 * Uses cache config from api-contracts.ts to determine how to cache each response.
 */

import { getCacheConfig } from "@/lib/shared";
import { logger } from "../logger-client";
import {
  cacheLibraries,
  cacheLibrary,
  cachePlaylists,
  cachePlaylist,
  cacheSongsForLibrary,
  cacheSongsForPlaylist,
  cacheSong,
} from "./metadata-cache";

/**
 * Cache a GET response to IndexedDB based on route configuration
 * Called by router after successful backend response
 * 
 * @param path - API path (e.g., /api/libraries, /api/libraries/:id/songs)
 * @param response - Cloned Response object to read JSON from
 */
export async function cacheResponseToIndexedDB(
  path: string,
  response: Response
): Promise<void> {
  // Only cache JSON responses
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return;
  }

  // Get cache configuration for this route
  const cacheInfo = getCacheConfig(path, "GET");
  if (!cacheInfo) {
    // Route doesn't have cache config, skip silently
    return;
  }

  const { config, params } = cacheInfo;

  try {
    const json = await response.json();
    
    // Only cache successful responses
    if (!json.success || json.data === undefined) {
      return;
    }

    const data = json.data;

    // Route to appropriate cache function based on config
    switch (config.table) {
      case "libraries":
        if (config.strategy === "replace-all") {
          await cacheLibraries(data);
        } else if (config.strategy === "upsert") {
          await cacheLibrary(data);
        }
        break;

      case "playlists":
        if (config.strategy === "replace-all") {
          await cachePlaylists(data);
        } else if (config.strategy === "upsert") {
          await cachePlaylist(data);
        }
        break;

      case "songs":
        if (config.strategy === "upsert") {
          await cacheSong(data);
        } else if (config.strategy === "replace-by-key") {
          // Validate keyParam is provided for replace-by-key strategy
          if (!config.keyParam || !(config.keyParam in params)) {
            logger.warn("[ResponseCache][cacheResponseToIndexedDB]", "Missing keyParam for replace-by-key strategy", { raw: { path, config, params } });
            return;
          }
          const keyValue = params[config.keyParam];
          if (config.updateJoinTable) {
            // This is playlist songs - update both songs and playlistSongs table
            await cacheSongsForPlaylist(keyValue, data);
          } else {
            // This is library songs
            await cacheSongsForLibrary(keyValue, data);
          }
        }
        break;

      // No default case needed - TypeScript ensures exhaustive switch on CacheTable union
    }

    logger.debug("[ResponseCache][cacheResponseToIndexedDB]", "Cached response", { raw: { path, table: config.table, strategy: config.strategy } });
  } catch (error) {
    // Log but don't throw - caching failure shouldn't break the request
    logger.error("[ResponseCache][cacheResponseToIndexedDB]", "Failed to cache response", error, { raw: { path } });
  }
}
