/**
 * Library entity types
 * Used by backend, frontend, and offline proxy
 */

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
  coverUrl: string | null;  // Computed: last added song's cover
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
}
