/**
 * Main API Response Types
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface ApiPaginatedResponse<T> extends ApiResponse<T> {
  pagination?: {
    page: number;
    perPage: number;
    total: number;
  };
}
