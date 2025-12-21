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
 * @returns Full URL to cover image, or undefined if no songId
 * 
 * @example
 * buildCoverUrl("abc123")
 * // → "http://localhost:4000/api/songs/abc123/cover" (local dev)
 * // → "https://api.m3w.example.com/api/songs/abc123/cover" (production)
 * 
 * buildCoverUrl(null) // → undefined
 */
export function buildCoverUrl(songId: string | null | undefined): string | undefined {
  if (!songId) return undefined;
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
