/**
 * Main API Client
 * Wraps the generic HTTP client and handles Main API specific response format
 */

import { apiClient } from "@/lib/api/client";
import type { ApiResponse } from "./types";

export class MainApiClient {
  /**
   * GET request with response unwrapping
   */
  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await apiClient.get<ApiResponse<T>>(endpoint, options);

    if (!response.success) {
      throw new Error(response.error || "Request failed");
    }

    return response.data as T;
  }

  /**
   * POST request with response unwrapping
   */
  async post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    const response = await apiClient.post<ApiResponse<T>>(endpoint, body, options);

    if (!response.success) {
      throw new Error(response.error || "Request failed");
    }

    return response.data as T;
  }

  /**
   * PUT request with response unwrapping
   */
  async put<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    const response = await apiClient.put<ApiResponse<T>>(endpoint, body, options);

    if (!response.success) {
      throw new Error(response.error || "Request failed");
    }

    return response.data as T;
  }

  /**
   * PATCH request with response unwrapping
   */
  async patch<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    const response = await apiClient.patch<ApiResponse<T>>(endpoint, body, options);

    if (!response.success) {
      throw new Error(response.error || "Request failed");
    }

    return response.data as T;
  }

  /**
   * DELETE request with response unwrapping
   */
  async delete<T = void>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await apiClient.delete<ApiResponse<T>>(endpoint, options);

    if (!response.success) {
      throw new Error(response.error || "Request failed");
    }

    return response.data as T;
  }

  /**
   * Upload file with response unwrapping
   */
  async upload<T>(endpoint: string, formData: FormData, options?: RequestInit): Promise<T> {
    const response = await apiClient.upload<ApiResponse<T>>(endpoint, formData, options);

    if (!response.success) {
      throw new Error(response.error || "Upload failed");
    }

    return response.data as T;
  }
}

// Singleton instance
export const mainApiClient = new MainApiClient();
