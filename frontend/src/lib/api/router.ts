/**
 * API Router
 * Routes requests to backend or offline proxy based on:
 * 1. Network status (navigator.onLine + backend reachability)
 * 2. Route offline capability (from API contracts)
 * 
 * Also handles automatic caching of GET responses to IndexedDB for offline access.
 */

import { isOfflineCapable } from "@/lib/shared";
import { logger, type Trace } from "../logger-client";
import { API_BASE_URL } from "./config";
import { isGuestUser } from "../offline-proxy/utils";
import { cacheResponseToIndexedDB } from "../cache/response-cache";
import {
  getUserHomeRegion,
  getActiveEndpoint,
  ensureEndpointInitialized,
  getAuthToken,
} from "./multi-region";

/** Options for routeRequest */
export interface RouterOptions {
  /** Trace instance for request correlation. If not provided, logs go to global logger. */
  trace?: Trace;
}

/** Generate UUID for traceId (with fallback for non-secure contexts like LAN HTTP) */
function generateTraceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // Falls through to fallback
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
  
  logger.info("[Router][startHealthCheck]", "Starting backend health check polling");
  healthCheckInterval = setInterval(async () => {
    if (!isBackendReachable) {
      logger.debug("[Router][healthCheck]", "Checking backend health...");
      const isHealthy = await checkBackendHealth();
      if (isHealthy) {
        logger.info("[Router][healthCheck]", "Backend recovered, stopping health checks");
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
    logger.info("[Router][stopHealthCheck]", "Stopped backend health check polling");
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
    logger.info("[Router][emitNetworkStatus]", "Backend reachability changed", { raw: { isReachable } });
  }
}

// API Router
export async function routeRequest(
  path: string,
  init?: RequestInit,
  options?: RouterOptions
): Promise<Response> {
  const method = init?.method || "GET";
  const isOnline = navigator.onLine;
  const offlineCapable = isOfflineCapable(path, method);
  const isGuest = isGuestUser();
  
  // Use trace if provided, otherwise global logger with shared traceId
  const traceId = options?.trace?.traceId || generateTraceId();
  const log = options?.trace || logger;

  // Guest Mode: Always use offline proxy for capable routes
  if (isGuest) {
    if (offlineCapable) {
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

  const effectivelyOffline = !isOnline || !isBackendReachable;
  const isWriteMethod = ["POST", "PUT", "DELETE", "PATCH"].includes(method);

  // Auth users in offline mode are read-only
  if (effectivelyOffline && isWriteMethod) {
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
      return await callOfflineProxy(path, init);
    } else {
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

  // Online: try backend
  try {
    await ensureEndpointInitialized();

    const baseUrl = getActiveEndpoint() || API_BASE_URL;
    const fullUrl = path.startsWith("http") ? path : `${baseUrl}${path}`;

    const headers = new Headers(init?.headers);
    headers.set("X-Trace-Id", traceId);
    
    const authToken = getAuthToken();
    if (authToken) {
      headers.set("Authorization", `Bearer ${authToken}`);
    }
    
    const homeRegion = getUserHomeRegion();
    if (homeRegion) {
      headers.set("X-Region", homeRegion);
    }

    const response = await fetch(fullUrl, {
      ...init,
      credentials: "include",
      headers,
    });

    emitNetworkStatus(true);

    if (response.ok) {
      if (method === "GET") {
        cacheResponseToIndexedDB(path, response.clone()).catch(() => {});
      }
      log.info(`${method} ${path}`, "OK", { traceId, raw: { status: response.status } });
      return response;
    }
    
    // Backend error
    log.error(`${method} ${path}`, "Failed", undefined, { traceId, raw: { status: response.status } });
    
    if (offlineCapable) {
      return await callOfflineProxy(path, init);
    }
    return response;
  } catch (error) {
    emitNetworkStatus(false);

    log.error(`${method} ${path}`, "Network error", error, { traceId });

    if (offlineCapable) {
      return await callOfflineProxy(path, init);
    }

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
    logger.error("[Router][callOfflineProxy]", "Offline proxy failed", error, { raw: { path } });
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
