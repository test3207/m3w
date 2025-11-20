/**
 * Custom Service Worker for M3W
 * Handles authentication token injection and media caching
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
 * Handle media requests (audio/cover files)
 * Supports both authenticated (/api/songs/*) and guest (/guest/songs/*) URLs
 */
async function handleMediaRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const cache = await caches.open(CACHE_NAME);

  // 1. Check cache first (works for both Auth and Guest)
  const cached = await cache.match(request);
  if (cached) {
    console.log('[SW] ✅ Serving from cache:', url.pathname);
    return cached;
  }

  // 2. Not cached
  if (url.pathname.startsWith('/guest/songs/')) {
    // Guest mode: Should always be cached, return 404 if not found
    console.error('[SW] ❌ Guest file not found in cache:', url.pathname);
    return new Response('Guest file not found in cache', { 
      status: 404,
      statusText: 'Not Found',
    });
  }

  // 3. Auth mode: Fetch from backend with token
  try {
    const token = await getAuthToken();
    
    // Build headers
    const headers = new Headers(request.headers);
    
    // Only set Authorization header if token exists
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    
    // Clone request with new headers
    const authenticatedRequest = new Request(request, {
      headers,
    });

    console.log('[SW] 🌐 Fetching from backend:', url.pathname, token ? '(with token)' : '(no token)');
    const response = await fetch(authenticatedRequest);

    // Cache successful complete responses (200 OK)
    // Don't cache partial content (206) to avoid Range request issues
    if (response.ok && response.status === 200) {
      // Clone response before caching
      const responseToCache = response.clone();
      
      // Cache asynchronously (don't block return)
      cache.put(request, responseToCache).then(() => {
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
  const isMediaRequest =
    url.pathname.match(/\/api\/songs\/[^/]+\/(stream|cover)/) ||
    url.pathname.match(/\/guest\/songs\/[^/]+\/(stream|cover)/);

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
