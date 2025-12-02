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
import { precacheAndRoute } from 'workbox-precaching';

// Precache static assets (injected by Vite PWA plugin)
// Use self.__WB_MANIFEST for Workbox to inject the precache manifest
precacheAndRoute(self.__WB_MANIFEST);

const CACHE_NAME = 'm3w-media-v1';
const AUTH_DB_NAME = 'm3w-auth';
const AUTH_STORE_NAME = 'tokens';

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

      const transaction = db.transaction([AUTH_STORE_NAME], 'readonly');
      const store = transaction.objectStore(AUTH_STORE_NAME);
      const getRequest = store.get('accessToken');

      getRequest.onsuccess = () => {
        resolve(getRequest.result || null);
      };

      getRequest.onerror = () => {
        console.error('[SW] Failed to get token:', getRequest.error);
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
    console.error('[SW] Invalid Range header:', rangeHeader);
    return new Response('Invalid Range header', { status: 416 });
  }
  
  const start = parseInt(rangeMatch[1], 10);
  const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : totalSize - 1;
  
  // Validate range
  if (start >= totalSize || end >= totalSize || start > end) {
    console.error('[SW] Range out of bounds:', { start, end, totalSize });
    return new Response('Range Not Satisfiable', { 
      status: 416,
      headers: {
        'Content-Range': `bytes */${totalSize}`,
      },
    });
  }
  
  // Extract requested slice
  const slicedBuffer = arrayBuffer.slice(start, end + 1);
  const contentLength = slicedBuffer.byteLength;
  
  console.log('[SW] 📊 Range request:', { start, end, contentLength, totalSize });
  
  // Return 206 Partial Content
  return new Response(slicedBuffer, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': cachedResponse.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Length': contentLength.toString(),
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
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
    console.log('[SW] ✅ Serving from cache:', url.pathname);
    
    // Handle Range requests (for seeking)
    const rangeHeader = request.headers.get('Range');
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
    console.log('[SW] ℹ️ Guest mode - file not cached:', url.pathname);
    return new Response('File not available offline (Guest mode)', { 
      status: 404,
      statusText: 'Not Found',
    });
  }

  // 3. Auth mode: Fetch from backend with token
  try {
    // Build headers with auth token
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${token}`);
    
    // Clone request with new headers
    const authenticatedRequest = new Request(request, {
      headers,
    });

    console.log('[SW] 🌐 Fetching from backend:', url.pathname);
    const response = await fetch(authenticatedRequest);

    // Cache successful complete responses (200 OK)
    // Don't cache partial content (206) to avoid Range request issues
    if (response.ok && response.status === 200) {
      // Clone response before caching
      const responseToCache = response.clone();
      
      // Cache asynchronously (don't block return)
      // Use pathname as cache key (same as match) to handle port differences
      cache.put(cacheKey, responseToCache).then(() => {
        console.log('[SW] ✅ Cached from backend:', url.pathname);
      }).catch((error) => {
        console.error('[SW] ❌ Failed to cache:', error);
      });
    }

    return response;
  } catch (error) {
    console.error('[SW] ❌ Fetch error:', error);
    
    // Return offline error
    return new Response('Network error', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Install event: Setup cache
 * Note: Use skipWaiting carefully - it can interrupt ongoing operations
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(() => {
      console.log('[SW] ✅ Cache created');
      // Don't skip waiting automatically during install
      // Let the user decide when to update via the reload prompt
      // This prevents interrupting OAuth flows or active playback
    })
  );
});

/**
 * Activate event: Claim clients and cleanup old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    Promise.all([
      // Cleanup old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName.startsWith('m3w-media-')) {
              console.log('[SW] 🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim(),
    ]).then(() => {
      console.log('[SW] ✅ Service worker activated');
    })
  );
});

/**
 * Fetch event: Intercept media requests
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

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
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        console.log('[SW] ✅ Cache cleared');
        return caches.open(CACHE_NAME);
      })
    );
  }
});

// Export empty object to make this a module
export {};
