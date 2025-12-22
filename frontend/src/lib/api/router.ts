/**
 * API Router
 * Routes requests to backend or offline proxy based on:
 * 1. Network status (navigator.onLine + backend reachability)
 * 2. Route offline capability (from API contracts)
 * 
 * Also handles automatic caching of GET responses to IndexedDB for offline access.
 */

import { isOfflineCapable } from "@/lib/shared";
import { logger } from "../logger-client";
import { API_BASE_URL } from "./config";
import { isGuestUser } from "../offline-proxy/utils";
import { cacheResponseToIndexedDB } from "../cache/response-cache";
import {
  getUserHomeRegion,
  getActiveEndpoint,
  ensureEndpointInitialized,
  getAuthToken,
} from "./multi-region";

// Lazy-loaded offline proxy module to reduce initial bundle size
// The offline-proxy includes Hono + music-metadata; lazy-loading saves ~36KB from the main bundle
let offlineProxyModule: typeof import("../offline-proxy") | null = null;

async function getOfflineProxy() {
  if (!offlineProxyModule) {
    offlineProxyModule = await import("../offline-proxy");
  }
  return offlineProxyModule.default;
}

// Track backend reachability
let isBackendReachable = true;
let healthCheckInterval: NodeJS.Timeout | null = null;

// Health check function - ping backend to detect recovery
async function checkBackendHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    // Use standard health check path (not /api/health)
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      credentials: "include",
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

// Start health check polling (only when backend is unreachable)
function startHealthCheck() {
  if (healthCheckInterval) return;
  
  logger.info("Starting backend health check polling");
  healthCheckInterval = setInterval(async () => {
    if (!isBackendReachable) {
      logger.debug("Checking backend health...");
      const isHealthy = await checkBackendHealth();
      if (isHealthy) {
        logger.info("Backend recovered, stopping health checks");
        emitNetworkStatus(true);
        stopHealthCheck();
      }
    }
  }, 5000); // Check every 5 seconds
}

// Stop health check polling
function stopHealthCheck() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    logger.info("Stopped backend health check polling");
  }
}

// Helper to emit network status events
function emitNetworkStatus(isReachable: boolean) {
  if (isReachable !== isBackendReachable) {
    isBackendReachable = isReachable;
    
    if (!isReachable) {
      startHealthCheck(); // Start polling when backend becomes unreachable
    } else {
      stopHealthCheck(); // Stop polling when backend recovers
    }
    
    window.dispatchEvent(new CustomEvent(isReachable ? "api-success" : "api-error"));
    logger.info("Backend reachability changed", { isReachable });
  }
}

// API Router
export async function routeRequest(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const method = init?.method || "GET";
  const isOnline = navigator.onLine;
  const offlineCapable = isOfflineCapable(path, method);
  const isGuest = isGuestUser();

  // Guest Mode: Always use offline proxy for capable routes
  if (isGuest) {
    if (offlineCapable) {
      logger.info("Guest mode: Using offline proxy", { path, method });
      return await callOfflineProxy(path, init);
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: "This feature is not available in Guest Mode",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // Decision matrix:
  // 1. Guest mode: use offline proxy for all capable routes
  // 2. Auth + Offline + Write: block (read-only mode per User Stories)
  // 3. Auth + Offline + Read: use offline proxy if capable
  // 4. Auth + Online: try backend, fallback to offline proxy if capable

  const effectivelyOffline = !isOnline || !isBackendReachable;

  // Auth users in offline mode are read-only (no writes allowed)
  // This enforces the design decision from User Stories Part 3
  // Only block actual write methods, allow safe methods like HEAD/OPTIONS
  const isWriteMethod = ["POST", "PUT", "DELETE", "PATCH"].includes(method);
  if (effectivelyOffline && !isGuest && isWriteMethod) {
    logger.info("Blocking write operation for Auth user offline", { path, method });
    return new Response(
      JSON.stringify({
        success: false,
        error: "This operation requires an internet connection",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (effectivelyOffline) {
    if (offlineCapable) {
      logger.info("Using offline proxy", { path, method, reason: !isOnline ? "no network" : "backend unreachable" });
      return await callOfflineProxy(path, init);
    } else {
      // Cannot fulfill request offline
      return new Response(
        JSON.stringify({
          success: false,
          error: "This operation requires an internet connection",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // Online: try backend first
  try {
    // Ensure multi-region endpoint is initialized before making requests
    // This is a no-op if multi-region is not enabled or already initialized
    await ensureEndpointInitialized();

    // Build full backend URL from path
    // Use active endpoint (fallback) if Gateway is down, otherwise use default API_BASE_URL
    const baseUrl = getActiveEndpoint() || API_BASE_URL;
    const fullUrl = path.startsWith("http")
      ? path
      : `${baseUrl}${path}`;

    // Build headers with auth token and region preference using Headers API for type safety
    const headers = new Headers(init?.headers);
    
    // Add authorization header if token exists
    const authToken = getAuthToken();
    if (authToken) {
      headers.set("Authorization", `Bearer ${authToken}`);
    }
    
    // Add X-Region header for multi-region routing (Gateway uses this for routing hints)
    const homeRegion = getUserHomeRegion();
    if (homeRegion) {
      headers.set("X-Region", homeRegion);
    }

    const response = await fetch(fullUrl, {
      ...init,
      credentials: "include",
      headers,
    });

    // Mark backend as reachable on successful connection
    emitNetworkStatus(true);

    // If backend succeeds, cache GET responses and return
    if (response.ok) {
      // Cache GET JSON responses to IndexedDB for offline access (non-blocking)
      // Note: Guest users return early at line 108-124, so only Auth users reach this caching logic
      if (method === "GET") {
        cacheResponseToIndexedDB(path, response.clone()).catch(err =>
          logger.warn("Failed to cache response", { path, err })
        );
      }
      return response;
    }
    
    // If backend fails but route is not offline-capable, return the error response
    if (!offlineCapable) {
      return response;
    }

    // If backend fails and route is offline-capable, fallback to offline proxy
    logger.warn("Backend request failed, falling back to offline proxy", { path, status: response.status });
    return await callOfflineProxy(path, init);
  } catch (error) {
    // Mark backend as unreachable on connection error
    emitNetworkStatus(false);

    // Network error: fallback to offline proxy if possible
    if (offlineCapable) {
      logger.warn("Backend unreachable, using offline proxy", { path, error });
      return await callOfflineProxy(path, init);
    }

    // Cannot fallback, return error
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to connect to server",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Call offline proxy
async function callOfflineProxy(
  path: string,
  init?: RequestInit
): Promise<Response> {
  try {
    // Dynamically load offline proxy module (lazy loading)
    const offlineProxy = await getOfflineProxy();
    
    // Create a mock Request object for Hono
    const request = new Request(`http://localhost${path}`, init);

    // Call offline proxy via Hono fetch
    return await offlineProxy.fetch(request);
  } catch (error) {
    logger.error("Offline proxy failed", { path, error });
    return new Response(
      JSON.stringify({
        success: false,
        error: "Offline operation failed",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
