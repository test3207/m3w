import { HttpStatusCode } from "@/lib/constants/http-status";
import { logger } from "@/lib/logger-client";
import { routeRequest } from "./router";
import { API_BASE_URL } from "./config";

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
  /** Suppress error logging (for expected errors like demo mode check) */
  silent?: boolean;
}

/**
 * Low-level API client for making HTTP requests with consistent error handling
 * 
 * ⚠️ This is a low-level client. Most business logic should use higher-level clients:
 * - For JSON API calls: Use `mainApiClient` from @/services/api/main/client
 * - For binary/stream data: Use `streamApiClient` from @/services/api/stream/client
 * 
 * This client handles:
 * - Building URLs with base URL and query parameters
 * - Setting common headers (Content-Type, Authorization via router)
 * - Error handling and logging
 * - Support for both JSON and non-JSON responses
 */
class ApiClient {
  private baseURL: string;

  constructor(baseURL = "/api") {
    this.baseURL = baseURL;
  }

  /**
   * Build URL with query parameters
   */
  private buildURL(endpoint: string, params?: Record<string, string | number | boolean>): string {
    // Remove leading slash from endpoint to allow proper concatenation
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
    const baseWithSlash = this.baseURL.endsWith("/") ? this.baseURL : `${this.baseURL}/`;

    // Build full URL with backend base URL
    const url = new URL(cleanEndpoint, baseWithSlash);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    return url.toString();
  }

  /**
   * Make HTTP request with error handling
   */
  private async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const { params, silent, ...fetchOptions } = options;
    const url = this.buildURL(endpoint, params);

    try {
      logger.info("API request", { url, method: options.method || "GET" });

      // Build headers - don't set Content-Type for FormData (browser will set it with boundary)
      const headers: HeadersInit = { ...fetchOptions.headers };
      if (!(fetchOptions.body instanceof FormData) && typeof headers === "object" && !Array.isArray(headers)) {
        (headers as Record<string, string>)["Content-Type"] = "application/json";
      }

      // Extract pathname and search params for routeRequest (it will build full URL internally)
      const urlObj = new URL(url);
      const path = urlObj.pathname + urlObj.search; // Include query params!

      const response = await routeRequest(path, {
        ...fetchOptions,
        headers,
      });

      // Handle non-JSON responses (e.g., audio streams)
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        if (!response.ok) {
          // Don't log expected errors when silent mode is enabled
          if (!silent) {
            logger.error("API error (non-JSON)", {
              status: response.status,
              statusText: response.statusText,
            });
          }
          throw new ApiError(
            response.status,
            response.statusText,
            `Request failed: ${response.statusText || response.status}`
          );
        }
        return response as unknown as T;
      }

      // Parse JSON response
      const data = await response.json();

      if (!response.ok) {
        if (!silent) {
          logger.error("API error", {
            status: response.status,
            statusText: response.statusText,
            data,
          });
        }

        throw new ApiError(
          response.status,
          response.statusText,
          data.message || data.error || response.statusText,
          data
        );
      }

      logger.info("API response", { url, status: response.status });
      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (!silent) {
        logger.error("API request failed", { error, url });
      }
      throw new ApiError(
        HttpStatusCode.INTERNAL_SERVER_ERROR,
        "Request Failed",
        error instanceof Error ? error.message : "Unknown error occurred"
      );
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "GET",
    });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "DELETE",
    });
  }

  /**
   * Upload file with multipart/form-data
   */
  async upload<T>(endpoint: string, formData: FormData, options?: ApiRequestOptions): Promise<T> {
    const { headers, ...restOptions } = options || {};

    return this.request<T>(endpoint, {
      ...restOptions,
      method: "POST",
      body: formData,
      headers: {
        ...headers,
        // Don't set Content-Type for FormData, browser will set it with boundary
      },
    });
  }
}

/**
 * Low-level API client instance
 * 
 * ⚠️ Prefer using higher-level clients:
 * - `mainApiClient` for JSON API calls
 * - `streamApiClient` for binary/stream data
 */
export const apiClient = new ApiClient(API_BASE_URL);
