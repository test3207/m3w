/**
 * Library entity types
 * Used by backend, frontend, and offline proxy
 */

// ============================================================
// Cache Override Type
// ============================================================

export type CacheOverride = 'inherit' | 'always' | 'never';

// ============================================================
// Library API Response
// ============================================================

export interface Library {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  songCount: number;  // Cached count, updated on add/delete
  isDefault: boolean;
  canDelete: boolean;
  cacheOverride: CacheOverride;  // Offline cache policy
  coverSongId: string | null;  // Song ID for cover art (use buildCoverUrl(id) to get URL)
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
}

// ============================================================
// Library Input Types
// ============================================================

export interface CreateLibraryInput {
  name: string;
  description?: string | null;
}

export interface UpdateLibraryInput {
  name?: string;
  description?: string | null;
  cacheOverride?: CacheOverride;
}
