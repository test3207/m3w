/**
 * Prefetch Module - Idle-time module preloading
 * 
 * Uses requestIdleCallback to preload heavy modules during browser idle time.
 * This ensures the modules are cached and ready when actually needed,
 * without blocking initial page load.
 */

import { logger } from "./logger-client";

// Track which modules have been prefetched
const prefetchedModules = new Set<string>();

/**
 * Prefetch a module during browser idle time
 * @param moduleLoader - Dynamic import function
 * @param name - Module name for logging
 */
function prefetchModule(moduleLoader: () => Promise<unknown>, name: string): void {
  if (prefetchedModules.has(name)) return;
  prefetchedModules.add(name);
  
  const callback = () => {
    moduleLoader()
      .then(() => logger.debug(`Prefetched module: ${name}`))
      .catch(() => logger.debug(`Failed to prefetch: ${name}`));
  };
  
  // Use requestIdleCallback if available, otherwise setTimeout
  if ("requestIdleCallback" in window) {
    requestIdleCallback(callback, { timeout: 5000 });
  } else {
    setTimeout(callback, 2000);
  }
}

/**
 * Start prefetching heavy modules after initial page load
 * Called once after app mounts and becomes interactive
 */
export function startIdlePrefetch(): void {
  // Wait a bit for initial render to complete
  setTimeout(() => {
    // Prefetch cache-manager (contains music-metadata ~100KB)
    // Needed for: upload, library delete
    prefetchModule(
      () => import("@/lib/pwa/cache-manager"),
      "cache-manager"
    );
  }, 3000); // 3 seconds after load
}
