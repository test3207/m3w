/**
 * Multi-Region Configuration
 * 
 * Runtime-configurable multi-region support for global deployment.
 * All configuration comes from runtime (window.__M3W_CONFIG__) or falls back to defaults.
 * 
 * Normal flow: All requests go to 3rd-level domain (Gateway)
 * Fallback flow: If Gateway is down, fallback to fastest 4th-level domain (direct region)
 * 
 * Local development: No multi-region, uses localhost directly
 * AIO deployment: No multi-region, uses same-origin
 * Multi-region deployment: Configuration injected via docker-entrypoint or CF Worker
 */

import { logger } from "../logger-client";

interface M3WConfig {
  // Whether multi-region mode is enabled
  multiRegion?: boolean;
  // Main domain (Gateway URL) - 3rd-level domain
  mainDomain?: string;
  // Available regions with their direct endpoints - 4th-level domains
  regions?: Array<{
    name: string;
    endpoint: string;
  }>;
  // Current region (set by Gateway routing)
  currentRegion?: string;
}

declare global {
  interface Window {
    // Can be: undefined | placeholder string | actual config object
    __M3W_CONFIG__?: M3WConfig | string;
  }
}

// Cached active endpoint (determined at startup)
let activeEndpoint: string | null = null;
let endpointCheckPromise: Promise<void> | null = null;

// Flag to log placeholder warning only once per page load
let hasLoggedPlaceholderWarning = false;

/**
 * Get multi-region configuration from runtime
 * Returns null if multi-region is not configured (local dev / AIO mode)
 */
export function getMultiRegionConfig(): M3WConfig | null {
  if (typeof window === "undefined") return null;
  
  const config = window.__M3W_CONFIG__;
  
  // Placeholder string was not replaced by CF Worker or docker-entrypoint
  // This indicates a deployment/configuration issue when multi-region is expected
  if (config === "__M3W_CONFIG__") {
    if (!hasLoggedPlaceholderWarning) {
      hasLoggedPlaceholderWarning = true;
      logger.debug("[Multi-Region] __M3W_CONFIG__ placeholder not replaced, using non-multi-region mode");
    }
    return null;
  }
  
  // No config provided (local dev / AIO)
  if (config === undefined) return null;
  
  // Config exists but multi-region not enabled
  if (typeof config === "string" || !config.multiRegion) return null;
  
  return config;
}

/**
 * Check if multi-region mode is enabled
 */
export function isMultiRegionEnabled(): boolean {
  return getMultiRegionConfig() !== null;
}

/**
 * Get user's home region from JWT access token
 * The homeRegion is encoded in the JWT payload by the backend
 */
export function getUserHomeRegion(): string | null {
  if (typeof window === "undefined") return null;
  
  try {
    // Read from Zustand auth store (persisted in localStorage)
    const authStore = localStorage.getItem("auth-storage");
    if (!authStore) return null;
    
    const parsed = JSON.parse(authStore);
    const accessToken = parsed.state?.tokens?.accessToken;
    if (!accessToken || typeof accessToken !== "string") return null;
    
    // Decode JWT payload (base64url encoded, no verification needed for reading)
    // JWT format: header.payload.signature
    const parts = accessToken.split(".");
    if (parts.length !== 3) return null;
    
    // Decode base64url payload
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.homeRegion || null;
  } catch (err) {
    logger.debug("[Multi-Region] Failed to read homeRegion from JWT", { err });
    return null;
  }
}

/**
 * Check health of an endpoint and measure latency
 * Returns latency in ms if healthy, null if unavailable
 */
export async function checkEndpointLatency(
  endpoint: string,
  timeoutMs = 5000
): Promise<number | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const start = performance.now();
    const response = await fetch(`${endpoint}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    const latency = performance.now() - start;
    
    return response.ok ? latency : null;
  } catch (err) {
    logger.warn("[Multi-Region] Endpoint health check failed", { endpoint, err });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Initialize endpoint detection - call this when app starts
 * Checks Gateway (3rd-level domain) first, falls back to fastest region (4th-level)
 * Safe to call multiple times - only executes once
 */
export async function initializeEndpoint(): Promise<void> {
  // Dedup: return existing promise if already initializing
  if (endpointCheckPromise) {
    return endpointCheckPromise;
  }
  
  const config = getMultiRegionConfig();
  
  // No multi-region configured - use default API_BASE_URL
  if (!config) {
    activeEndpoint = null;
    return;
  }
  
  // Start initialization and cache the promise
  endpointCheckPromise = (async () => {
    // Check Gateway (3rd-level domain) first
    if (config.mainDomain) {
      const gatewayLatency = await checkEndpointLatency(config.mainDomain);
      if (gatewayLatency !== null) {
        activeEndpoint = config.mainDomain;
        logger.info("[Multi-Region] Using Gateway", { endpoint: activeEndpoint, latency: Math.round(gatewayLatency) });
        return;
      }
      logger.warn("[Multi-Region] Gateway unavailable, checking region endpoints...");
    }
    
    // Gateway down - find fastest region endpoint (4th-level domain)
    // Filter out mainDomain to avoid duplicate checks
    // Note: Parallel requests are safe here - typically only 2-4 regions configured,
    // and health endpoints are lightweight, so no risk of rate limiting
    if (config.regions && config.regions.length > 0) {
      const regionEndpoints = config.regions.filter(
        (region) => region.endpoint !== config.mainDomain
      );
      
      if (regionEndpoints.length > 0) {
        const results = await Promise.all(
          regionEndpoints.map(async (region) => {
            const latency = await checkEndpointLatency(region.endpoint);
            return { endpoint: region.endpoint, name: region.name, latency };
          })
        );
        
        const available = results
          .filter((r): r is { endpoint: string; name: string; latency: number } => r.latency !== null)
          .sort((a, b) => a.latency - b.latency);
        
        if (available.length > 0) {
          activeEndpoint = available[0].endpoint;
          logger.info("[Multi-Region] Using fallback", { name: available[0].name, latency: Math.round(available[0].latency) });
          return;
        }
      }
    }
    
    // All endpoints down
    activeEndpoint = null;
    logger.error("[Multi-Region] All endpoints unavailable!");
  })();
  
  return endpointCheckPromise;
}

/**
 * Ensure endpoint is initialized (lazy initialization)
 */
export async function ensureEndpointInitialized(): Promise<void> {
  if (!isMultiRegionEnabled()) return;
  
  // Use nullish coalescing assignment for atomic check-and-set
  endpointCheckPromise ??= initializeEndpoint();
  await endpointCheckPromise;
}

/**
 * Get the active API endpoint
 * Returns null if using default (API_BASE_URL), or the active fallback endpoint
 */
export function getActiveEndpoint(): string | null {
  return activeEndpoint;
}

// Promise used to deduplicate concurrent recheckEndpoints calls
let endpointRecheckPromise: Promise<void> | null = null;

/**
 * Force re-check endpoints (e.g., when network status changes)
 * Safe to call multiple times - only one recheck runs at a time
 */
export async function recheckEndpoints(): Promise<void> {
  if (!isMultiRegionEnabled()) return;

  // Dedup: reuse existing recheck promise if one is in progress
  if (endpointRecheckPromise) {
    await endpointRecheckPromise;
    return;
  }

  // Clear active endpoint to avoid exposing stale value during recheck
  activeEndpoint = null;

  endpointRecheckPromise = (async () => {
    // Reset initialization promise so ensureEndpointInitialized performs fresh check
    endpointCheckPromise = null;
    try {
      await ensureEndpointInitialized();
    } finally {
      endpointRecheckPromise = null;
    }
  })();

  await endpointRecheckPromise;
}

/**
 * Find available endpoint for auth callback fallback
 * Used when frontend receives OAuth code directly (Gateway down scenario)
 */
export async function findAvailableEndpoint(): Promise<string | null> {
  await ensureEndpointInitialized();
  return activeEndpoint;
}
