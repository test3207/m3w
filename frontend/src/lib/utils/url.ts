/**
 * URL Utilities for Media Resources
 * 
 * Build URLs for media resources (cover images, audio streams).
 * Supports multi-gateway fallback by using the current active endpoint.
 */

import { getActiveEndpoint } from "@/lib/api/multi-region";
import { API_BASE_URL } from "@/lib/api/config";

/**
 * Get the current API base URL (supports multi-gateway fallback)
 */
function getApiBase(): string {
  return getActiveEndpoint() || API_BASE_URL;
}

/**
 * Build cover image URL for a song
 * 
 * @param songId - Song ID (can be null/undefined)
 * @returns Full URL to cover image, or null if no songId
 * 
 * @example
 * buildCoverUrl("abc123")
 * // → "http://localhost:4000/api/songs/abc123/cover" (local dev)
 * // → "https://api.m3w.example.com/api/songs/abc123/cover" (production)
 * 
 * buildCoverUrl(null) // → null
 */
export function buildCoverUrl(songId: string | null | undefined): string | null {
  if (!songId) return null;
  return `${getApiBase()}/api/songs/${songId}/cover`;
}

/**
 * Build audio stream URL for a song
 * 
 * @param songId - Song ID
 * @returns Full URL to audio stream
 * 
 * @example
 * buildStreamUrl("abc123")
 * // → "http://localhost:4000/api/songs/abc123/stream"
 */
export function buildStreamUrl(songId: string): string {
  return `${getApiBase()}/api/songs/${songId}/stream`;
}

/**
 * Resolve a media URL to a full URL (legacy support)
 * 
 * @deprecated Use buildCoverUrl() or buildStreamUrl() instead
 * @param url - Relative path or absolute URL
 * @returns Full URL, or null if input is null/undefined
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  // Already absolute URL
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  
  // Relative path: prepend API base
  const baseUrl = getApiBase();
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = url.startsWith("/") ? url : `/${url}`;
  return `${normalizedBase}${normalizedPath}`;
}
