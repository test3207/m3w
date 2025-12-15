/**
 * Shared helper functions for k6 load tests
 */

import http from 'k6/http';
import { check, fail } from 'k6';
import { CONFIG } from '../config.js';

/**
 * Get default headers with optional authentication
 */
export function getHeaders(includeAuth = true) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (includeAuth && CONFIG.ACCESS_TOKEN) {
    headers['Authorization'] = `Bearer ${CONFIG.ACCESS_TOKEN}`;
  }

  return headers;
}

/**
 * Build full URL from endpoint
 */
export function buildUrl(endpoint) {
  return `${CONFIG.BASE_URL}${endpoint}`;
}

/**
 * Make authenticated GET request
 */
export function authGet(endpoint, params = {}) {
  const url = buildUrl(endpoint);
  const response = http.get(url, {
    headers: getHeaders(),
    ...params,
  });

  if (CONFIG.DEBUG) {
    console.log(`GET ${endpoint} -> ${response.status}`);
  }

  return response;
}

/**
 * Make authenticated POST request
 */
export function authPost(endpoint, body, params = {}) {
  const url = buildUrl(endpoint);
  const response = http.post(url, JSON.stringify(body), {
    headers: getHeaders(),
    ...params,
  });

  if (CONFIG.DEBUG) {
    console.log(`POST ${endpoint} -> ${response.status}`);
  }

  return response;
}

/**
 * Make authenticated PUT request
 */
export function authPut(endpoint, body, params = {}) {
  const url = buildUrl(endpoint);
  const response = http.put(url, JSON.stringify(body), {
    headers: getHeaders(),
    ...params,
  });

  if (CONFIG.DEBUG) {
    console.log(`PUT ${endpoint} -> ${response.status}`);
  }

  return response;
}

/**
 * Make authenticated DELETE request
 */
export function authDelete(endpoint, params = {}) {
  const url = buildUrl(endpoint);
  const response = http.del(url, null, {
    headers: getHeaders(),
    ...params,
  });

  if (CONFIG.DEBUG) {
    console.log(`DELETE ${endpoint} -> ${response.status}`);
  }

  return response;
}

/**
 * Check if response is successful (2xx)
 */
export function isSuccess(response) {
  return response.status >= 200 && response.status < 300;
}

/**
 * Parse JSON response safely
 */
export function parseJson(response) {
  try {
    return JSON.parse(response.body);
  } catch {
    return null;
  }
}

/**
 * Standard response checks
 */
export function checkResponse(response, name) {
  return check(response, {
    [`${name}: status is 2xx`]: (r) => isSuccess(r),
    [`${name}: response time < 500ms`]: (r) => r.timings.duration < 500,
  });
}

/**
 * Get a random item from array
 */
export function randomItem(array) {
  if (!array || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate random string
 */
export function randomString(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Sleep with random jitter
 */
export function sleepWithJitter(baseMs, jitterMs = 100) {
  const jitter = Math.random() * jitterMs * 2 - jitterMs;
  const duration = Math.max(0, baseMs + jitter);
  return new Promise((resolve) => setTimeout(resolve, duration));
}

/**
 * Weighted random selection
 * @param {Array<{weight: number, value: any}>} items
 */
export function weightedRandom(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) {
      return item.value;
    }
  }

  return items[items.length - 1].value;
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Setup function to verify test prerequisites
 */
export function verifySetup() {
  // Check health endpoint
  const healthRes = http.get(buildUrl('/health'));
  if (!isSuccess(healthRes)) {
    fail(`Server not reachable at ${CONFIG.BASE_URL}`);
  }

  // Check authentication if token provided
  if (CONFIG.ACCESS_TOKEN) {
    const authRes = authGet('/api/auth/me');
    if (!isSuccess(authRes)) {
      console.warn('Warning: ACCESS_TOKEN may be invalid or expired');
    }
  }

  console.log(`✓ Setup verified: ${CONFIG.BASE_URL}`);
}
