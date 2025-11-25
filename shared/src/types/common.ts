/**
 * Common types used across the application
 * Includes API response wrappers, pagination, and shared utilities
 */

// ============================================================
// API Response Wrapper
// ============================================================

/**
 * Standard API response wrapper
 * All API endpoints return this structure
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  /** Validation error details (used with Zod validation) */
  details?: unknown;
}

// ============================================================
// Pagination
// ============================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================
// Authentication
// ============================================================

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// ============================================================
// User
// ============================================================

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
}

// ============================================================
// Demo Mode
// ============================================================

export interface StorageUsageInfo {
  used: number;
  limit: number;
  usedFormatted: string;
  limitFormatted: string;
  percentage: string;
}
