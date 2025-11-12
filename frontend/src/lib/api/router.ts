/**
 * API Router
 * Routes requests to backend or offline proxy based on:
 * 1. Network status (navigator.onLine)
 * 2. Route offline capability (from API contracts)
 */

import offlineProxy from '../offline-proxy';
import { isOfflineCapable } from '@m3w/shared';
import { logger } from '../logger-client';

// Backend API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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
      logger.info('Using offline proxy', { path, method });
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
    // Build full backend URL from path
    const fullUrl = new URL(path, API_BASE_URL).toString();
    
    const response = await fetch(fullUrl, {
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
    logger.warn('Backend request failed, falling back to offline proxy', { path, status: response.status });
    return await callOfflineProxy(path, init);
  } catch (error) {
    // Network error: fallback to offline proxy if possible
    if (offlineCapable) {
      logger.warn('Backend unreachable, using offline proxy', { path, error });
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
    logger.error('Offline proxy failed', { path, error });
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
