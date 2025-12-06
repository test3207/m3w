/**
 * Stream API Client
 * Specialized client for fetching binary data (audio streams, blobs, images)
 * Wraps the low-level apiClient and provides a clean interface for stream data
 */

import { apiClient } from "../../../lib/api/client";

/**
 * Stream API Client for binary data requests
 * 
 * Use this client when you need:
 * - Audio/video streams
 * - Binary file downloads
 * - Raw Response objects for Cache API
 * - Blob data for offline storage
 * 
 * Returns raw Response objects (not JSON parsed)
 */
export class StreamApiClient {
  /**
   * GET request that returns raw Response
   * Does not parse as JSON - returns the Response object directly
   * 
   * @param url - Full URL or endpoint path
   * @param options - Optional fetch options
   * @returns Raw Response object
   * 
   * @example
   * // Fetch audio stream
   * const response = await streamApiClient.get('/api/songs/123/stream');
   * const blob = await response.blob();
   * 
   * @example
   * // Fetch with range headers for partial content
   * const response = await streamApiClient.get('/api/songs/123/stream', {
   *   headers: { 'Range': 'bytes=0-1023' }
   * });
   */
  async get(url: string, options?: RequestInit): Promise<Response> {
    // Use apiClient which returns Response for non-JSON content
    return apiClient.get<Response>(url, options);
  }
}

/**
 * Singleton instance for stream data fetching
 * 
 * Use this instead of apiClient directly for binary/stream data
 */
export const streamApiClient = new StreamApiClient();
