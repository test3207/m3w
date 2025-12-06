/**
 * API Configuration
 * 
 * Provides runtime-configurable API base URL for Docker deployments.
 * Priority: Runtime config (Docker) > Build-time env var > Dev default
 */

/**
 * Get API base URL with runtime config support
 * 
 * In Docker AIO mode: empty string means same-origin (relative URLs)
 * In separated mode: full URL to backend
 * 
 * Runtime config is injected by docker-entrypoint scripts via window.__API_BASE_URL__
 */
export const getApiBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runtimeUrl = (window as any).__API_BASE_URL__;
    // If runtime config is set and not the placeholder
    // Note: Empty string is valid for AIO mode (relative URLs), so use !== undefined
    if (runtimeUrl !== undefined && runtimeUrl !== "__API_BASE_URL__") {
      return runtimeUrl;
    }
  }
  // Fallback to build-time env or dev default
  return import.meta.env.VITE_API_URL || "http://localhost:4000";
};

/**
 * Cached API base URL (evaluated once at module load)
 */
export const API_BASE_URL = getApiBaseUrl();
