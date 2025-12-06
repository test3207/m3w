/**
 * Main API Response Types
 */

import type { ApiResponse } from "@m3w/shared";

// Re-export shared type for convenience
export type { ApiResponse };

export interface ApiPaginatedResponse<T> extends ApiResponse<T> {
  pagination?: {
    page: number;
    perPage: number;
    total: number;
  };
}
