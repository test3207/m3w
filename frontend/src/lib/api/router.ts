/**
 * API Router
 * Routes requests to backend or offline proxy based on:
 * 1. Network status (navigator.onLine)
 * 2. Route offline capability (from API contracts)
 */

import offlineProxy from '../offline-proxy';
import { userDataRoutes, adminRoutes } from '@m3w/shared';

// Helper to get auth token from store
function getAuthToken(): string | null {
  try {
    // Zustand persist uses 'auth-storage' as the key name
    const authStore = localStorage.getItem('auth-storage');
    if (!authStore) return null;
    
    const parsed = JSON.parse(authStore);
    return parsed.state?.tokens?.accessToken || null;
  } catch {
    return null;
  }
}

// Check if a route is offline-capable
function isOfflineCapable(path: string, method: string): boolean {
  // Check user data routes
  for (const route of userDataRoutes) {
    if (matchRoute(path, route.path) && route.method === method) {
      return route.offlineCapable;
    }
  }

  // Check admin routes
  for (const route of adminRoutes) {
    if (matchRoute(path, route.path) && route.method === method) {
      return route.offlineCapable;
    }
  }

  // Default: not offline-capable
  return false;
}

// Simple route matcher (supports :id params)
function matchRoute(requestPath: string, routePattern: string): boolean {
  const requestParts = requestPath.split('/').filter(Boolean);
  const patternParts = routePattern.split('/').filter(Boolean);

  if (requestParts.length !== patternParts.length) {
    return false;
  }

  return patternParts.every((part, i) => {
    return part.startsWith(':') || part === requestParts[i];
  });
}

// API Router
export async function routeRequest(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const method = init?.method || 'GET';
  const isOnline = navigator.onLine;
  const offlineCapable = isOfflineCapable(path, method);

  // Decision matrix:
  // 1. If offline and route is offline-capable → use offline proxy
  // 2. If offline and route is NOT offline-capable → return error
  // 3. If online → try backend, fallback to offline proxy if offline-capable

  if (!isOnline) {
    if (offlineCapable) {
      // Use offline proxy
      return await callOfflineProxy(path, init);
    } else {
      // Cannot fulfill request offline
      return new Response(
        JSON.stringify({
          success: false,
          error: 'This operation requires an internet connection',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // Online: try backend first
  try {
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    // Path already includes /api prefix from API contracts
    const response = await fetch(`${backendUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...init?.headers,
        // Add authorization header if token exists
        ...(getAuthToken() ? { 'Authorization': `Bearer ${getAuthToken()}` } : {}),
      },
    });

    // If backend succeeds, return response
    if (response.ok || !offlineCapable) {
      return response;
    }

    // If backend fails and route is offline-capable, fallback to offline proxy
    console.warn(
      `Backend request failed for ${path}, falling back to offline proxy`
    );
    return await callOfflineProxy(path, init);
  } catch (error) {
    // Network error: fallback to offline proxy if possible
    if (offlineCapable) {
      console.warn(
        `Backend unreachable for ${path}, using offline proxy:`,
        error
      );
      return await callOfflineProxy(path, init);
    }

    // Cannot fallback, return error
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to connect to server',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
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
    console.error('Offline proxy error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Offline operation failed',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Export helper for common HTTP methods
export const api = {
  get: (path: string, init?: Omit<RequestInit, 'method'>) =>
    routeRequest(path, { ...init, method: 'GET' }),

  post: (path: string, body?: unknown, init?: Omit<RequestInit, 'method' | 'body'>) =>
    routeRequest(path, {
      ...init,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    }),

  patch: (path: string, body?: unknown, init?: Omit<RequestInit, 'method' | 'body'>) =>
    routeRequest(path, {
      ...init,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    }),

  put: (path: string, body?: unknown, init?: Omit<RequestInit, 'method' | 'body'>) =>
    routeRequest(path, {
      ...init,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    }),

  delete: (path: string, init?: Omit<RequestInit, 'method'>) =>
    routeRequest(path, { ...init, method: 'DELETE' }),
};
