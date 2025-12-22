/**
 * Custom Service Worker for M3W
 * Handles authentication token injection and media caching
 * 
 * All audio/cover requests use /api/songs/:id/stream and /api/songs/:id/cover
 * regardless of Guest or Auth mode. Service Worker handles auth token injection.
 */

/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// Import Workbox for precaching
import { precacheAndRoute } from "workbox-precaching";

// Precache static assets (injected by Vite PWA plugin)
// Use self.__WB_MANIFEST for Workbox to inject the precache manifest
precacheAndRoute(self.__WB_MANIFEST);

const CACHE_NAME = "m3w-media-v1";
const AVATAR_CACHE_NAME = "m3w-avatars-v1";
const AUTH_DB_NAME = "m3w-auth";
const AUTH_STORE_NAME = "tokens";

/** 1x1 transparent PNG for cover fallback (created once, reused) */
const TRANSPARENT_PNG = new Uint8Array([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, // RGBA, etc
  0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, // IDAT chunk
  0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, // IEND chunk
  0x42, 0x60, 0x82,
]);

/**
 * Lightweight logger for Service Worker
 * Service Workers run in isolated context, cannot import main thread modules
 */
const swLogger = {
  debug: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[SW Debug] ${message}`, data !== undefined ? data : "");
    }
  },
  info: (message: string, data?: unknown) => {
    console.info(`[SW Info] ${message}`, data !== undefined ? data : "");
  },
  warn: (message: string, data?: unknown) => {
    console.warn(`[SW Warning] ${message}`, data !== undefined ? data : "");
  },
  error: (message: string, data?: unknown) => {
    console.error(`[SW Error] ${message}`, data !== undefined ? data : "");
  },
};

/**
 * Get authentication token from IndexedDB
 * Note: Service Worker cannot access localStorage, must use IndexedDB
 */
async function getAuthToken(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AUTH_DB_NAME, 1);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;
      
      // Check if object store exists
      if (!db.objectStoreNames.contains(AUTH_STORE_NAME)) {
        resolve(null);
        return;
      }

      const transaction = db.transaction([AUTH_STORE_NAME], "readonly");
      const store = transaction.objectStore(AUTH_STORE_NAME);
      const getRequest = store.get("accessToken");

      getRequest.onsuccess = () => {
        resolve(getRequest.result || null);
      };

      getRequest.onerror = () => {
        swLogger.error("Failed to get token:", getRequest.error);
        resolve(null);
      };
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(AUTH_STORE_NAME)) {
        db.createObjectStore(AUTH_STORE_NAME);
      }
    };
  });
}

/**
 * Handle Range requests for cached audio files (enables seeking)
 * 
 * @param cachedResponse - Full cached response
 * @param rangeHeader - Range header value (e.g., "bytes=0-1023")
 * @returns 206 Partial Content response with requested byte range
 */
async function handleRangeRequest(cachedResponse: Response, rangeHeader: string): Promise<Response> {
  const arrayBuffer = await cachedResponse.arrayBuffer();
  const totalSize = arrayBuffer.byteLength;
  
  // Parse Range header: "bytes=start-end" or "bytes=start-"
  const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!rangeMatch) {
    swLogger.error("Invalid Range header:", rangeHeader);
    return new Response("Invalid Range header", { status: 416 });
  }
  
  const start = parseInt(rangeMatch[1], 10);
  const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : totalSize - 1;
  
  // Validate range
  if (start >= totalSize || end >= totalSize || start > end) {
    swLogger.error("Range out of bounds:", { start, end, totalSize });
    return new Response("Range Not Satisfiable", { 
      status: 416,
      headers: {
        "Content-Range": `bytes */${totalSize}`,
      },
    });
  }
  
  // Extract requested slice
  const slicedBuffer = arrayBuffer.slice(start, end + 1);
  const contentLength = slicedBuffer.byteLength;
  
  swLogger.debug("📊 Range request:", { start, end, contentLength, totalSize });
  
  // Return 206 Partial Content
  return new Response(slicedBuffer, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": cachedResponse.headers.get("Content-Type") || "audio/mpeg",
      "Content-Length": contentLength.toString(),
      "Content-Range": `bytes ${start}-${end}/${totalSize}`,
      "Accept-Ranges": "bytes",
    },
  });
}

/**
 * Handle media requests (audio/cover files)
 * 
 * Cache-first strategy:
 * 1. Check cache first (works for both Guest and Auth)
 * 2. Cache miss + no token (Guest): Return 404 (guest files must be cached during upload)
 * 3. Cache miss + has token (Auth): Fetch from backend with auth, cache for offline
 */
async function handleMediaRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const cache = await caches.open(CACHE_NAME);

  // 1. Check cache first (works for both Auth and Guest)
  // Use pathname as cache key to handle dev (port 3000) vs prod (port 4000) mismatch
  // In dev, frontend is :3000 but API responses come from :4000 via proxy
  const cacheKey = url.pathname;
  const cached = await cache.match(cacheKey);
  
  if (cached) {
    swLogger.debug("✅ Serving from cache:", url.pathname);
    
    // Handle Range requests (for seeking)
    const rangeHeader = request.headers.get("Range");
    if (rangeHeader) {
      return handleRangeRequest(cached, rangeHeader);
    }
    
    return cached;
  }

  // 2. Not cached - determine how to handle based on auth state
  // Check if we have auth token to determine mode
  const token = await getAuthToken();
  
  if (!token) {
    // No token = Guest mode
    // In Guest mode, all files should be cached during upload
    // If we reach here with an /api/ URL and no token, the file isn't available
    swLogger.info("ℹ️ Guest mode - file not cached:", url.pathname);
    return new Response("File not available offline (Guest mode)", { 
      status: 404,
      statusText: "Not Found",
    });
  }

  // 3. Auth mode: Fetch from backend with token
  try {
    // Build headers with auth token
    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${token}`);
    
    // Create new request with auth header
    // IMPORTANT: Use mode: 'cors' to avoid opaque responses from img tags
    // img tags default to no-cors, which returns status=0 opaque responses that can't be cached
    const authenticatedRequest = new Request(request.url, {
      method: request.method,
      headers,
      mode: "cors",
      credentials: "same-origin",
    });

    swLogger.debug("🌐 Fetching from backend:", url.pathname);
    const response = await fetch(authenticatedRequest);

    // Cache successful complete responses (200 OK)
    // Don't cache partial content (206) to avoid Range request issues
    if (response.ok && response.status === 200) {
      // Clone response before caching
      const responseToCache = response.clone();
      
      // Cache asynchronously (don't block return)
      // Use pathname as cache key (same as match) to handle port differences
      cache.put(cacheKey, responseToCache).then(() => {
        swLogger.debug("✅ Cached from backend:", url.pathname);
      }).catch((error) => {
        swLogger.error("❌ Failed to cache:", error);
      });
    }

    return response;
  } catch (error) {
    swLogger.error("❌ Fetch error:", error);
    
    // Return graceful fallback based on request type
    // Use precise regex to avoid false matches (e.g., song ID containing "cover")
    const isCoverRequest = /\/songs\/[^/]+\/cover$/.test(url.pathname);
    
    if (isCoverRequest) {
      // For cover images: return empty transparent image (1x1 pixel)
      // This allows UI to gracefully show placeholder instead of broken image
      swLogger.info("🖼️ Cover not cached, returning placeholder:", url.pathname);
      return new Response(TRANSPARENT_PNG, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-store", // Don't cache placeholder
        },
      });
    }
    
    // For audio streams: return service unavailable
    return new Response("Network error - audio not cached", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
}

/**
 * Install event: Setup cache
 * Note: Use skipWaiting carefully - it can interrupt ongoing operations
 */
self.addEventListener("install", (event) => {
  swLogger.info("Installing service worker...");
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(() => {
      swLogger.info("✅ Cache created");
      // Don't skip waiting automatically during install
      // Let the user decide when to update via the reload prompt
      // This prevents interrupting OAuth flows or active playback
    })
  );
});

/**
 * Activate event: Claim clients and cleanup old caches
 */
self.addEventListener("activate", (event) => {
  swLogger.info("Activating service worker...");
  
  event.waitUntil(
    Promise.all([
      // Cleanup old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Clean old media caches
            if (cacheName !== CACHE_NAME && cacheName.startsWith("m3w-media-")) {
              swLogger.info("🗑️ Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
            // Clean old avatar caches
            if (cacheName !== AVATAR_CACHE_NAME && cacheName.startsWith("m3w-avatars-")) {
              swLogger.info("🗑️ Deleting old avatar cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim(),
    ]).then(() => {
      swLogger.info("✅ Service worker activated");
    })
  );
});

/**
 * Handle GitHub avatar requests with caching
 * GitHub avatar URLs lack proper cache headers, causing Lighthouse warnings.
 * We cache them for 24 hours to improve performance.
 */
async function handleAvatarRequest(request: Request): Promise<Response> {
  const cache = await caches.open(AVATAR_CACHE_NAME);
  
  // Check cache first
  const cached = await cache.match(request);
  if (cached) {
    swLogger.debug("✅ Avatar from cache:", request.url);
    return cached;
  }
  
  // Fetch and cache
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      // Clone response before caching (response body can only be read once)
      cache.put(request, response.clone());
      swLogger.debug("📥 Avatar cached:", request.url);
    }
    
    return response;
  } catch (error) {
    swLogger.error("Failed to fetch avatar:", error);
    // Return a placeholder or let it fail
    return new Response("Avatar unavailable", { status: 503 });
  }
}

/**
 * Fetch event: Intercept media requests
 */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Cache GitHub avatars (improves Lighthouse score)
  if (url.hostname === "avatars.githubusercontent.com") {
    event.respondWith(handleAvatarRequest(event.request));
    return;
  }

  // Only intercept media requests (audio/cover)
  // Unified URL: /api/songs/:id/stream or /api/songs/:id/cover (works for both Guest and Auth)
  const isMediaRequest = url.pathname.match(/\/api\/songs\/[^/]+\/(stream|cover)/);

  if (isMediaRequest) {
    event.respondWith(handleMediaRequest(event.request));
  }
  
  // Let other requests pass through (handled by Workbox or default)
});

/**
 * Message event: Handle commands from main thread
 */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        swLogger.info("✅ Cache cleared");
        return caches.open(CACHE_NAME);
      })
    );
  }
});

// Export empty object to make this a module
export {};
