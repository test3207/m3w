/**
 * API Router
 * Routes requests to backend or offline proxy based on:
 * 1. Network status (navigator.onLine + backend reachability)
 * 2. Route offline capability (from API contracts)
 * 
 * Also handles automatic caching of GET responses to IndexedDB for offline access.
 */

import offlineProxy from "../offline-proxy";
import { isOfflineCapable } from "@m3w/shared";
import { logger } from "../logger-client";
import { API_BASE_URL } from "./config";
import { isGuestUser } from "../offline-proxy/utils";
import { cacheResponseToIndexedDB } from "../cache/response-cache";

// Track backend reachability
let isBackendReachable = true;
let healthCheckInterval: NodeJS.Timeout | null = null;

// Health check function - ping backend to detect recovery
async function checkBackendHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(`${API_BASE_URL}/api/health`, {
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

// Helper to get auth token from store
function getAuthToken(): string | null {
  try {
    // Zustand persist uses 'auth-storage' as the key name
    const authStore = localStorage.getItem("auth-storage");
    if (!authStore) return null;

    const parsed = JSON.parse(authStore);
    return parsed.state?.tokens?.accessToken || null;
  } catch {
    return null;
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
  // 1. If offline (network or backend) and route is offline-capable → use offline proxy
  // 2. If offline and route is NOT offline-capable → return error
  // 3. If online → try backend, fallback to offline proxy if offline-capable

  const effectivelyOffline = !isOnline || !isBackendReachable;

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
    // Build full backend URL from path
    // path may contain query params, so use it directly if it starts with /
    const fullUrl = path.startsWith("http")
      ? path
      : `${API_BASE_URL}${path}`;

    const response = await fetch(fullUrl, {
      ...init,
      credentials: "include",
      headers: {
        ...init?.headers,
        // Add authorization header if token exists
        ...(getAuthToken() ? { "Authorization": `Bearer ${getAuthToken()}` } : {}),
      },
    });

    // Mark backend as reachable on successful connection
    emitNetworkStatus(true);

    // If backend succeeds, cache GET responses and return
    if (response.ok) {
      // Cache GET JSON responses to IndexedDB for offline access (non-blocking)
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
