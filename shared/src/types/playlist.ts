/**
 * Playlist entity types
 * Used by backend, frontend, and offline proxy
 */

// ============================================================
// Playlist API Response
// ============================================================

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  songCount: number;  // Cached count, updated on add/remove
  linkedLibraryId: string | null; // Link to library for "Play All" playlists
  isDefault: boolean;
  canDelete: boolean;
  coverSongId: string | null;  // Song ID for cover art (use buildCoverUrl(id) to get URL)
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
}

/**
 * PlaylistSong join table entity
 * Composite primary key: [playlistId, songId]
 * Used for ordering songs within a playlist
 */
export interface PlaylistSong {
  playlistId: string;
  songId: string;
  order: number;
  addedAt: string; // ISO 8601 string
}

// ============================================================
// Playlist Input Types
// ============================================================

export interface CreatePlaylistInput {
  name: string;
  description?: string | null;
}

export interface UpdatePlaylistInput {
  name?: string;
  description?: string | null;
}

export interface AddSongToPlaylistInput {
  songId: string;
  position?: number;
}

export interface ReorderPlaylistSongsInput {
  songIds: string[];  // New order of song IDs
}

// ============================================================
// Playlist Operation Results
// ============================================================

/**
 * Result of adding/removing a song from a playlist
 * Used by POST /api/playlists/:id/songs and DELETE /api/playlists/:id/songs/:songId
 */
export interface PlaylistSongOperationResult {
  playlistId: string;
  songId: string;
  newSongCount: number;
}

/**
 * Result of reordering songs in a playlist
 * Used by PUT /api/playlists/:id/songs/reorder
 */
export interface PlaylistReorderResult {
  playlistId: string;
  songCount: number;
  updatedAt: string; // ISO 8601 string
}
