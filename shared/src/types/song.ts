/**
 * Song entity types
 * Used by backend, frontend, and offline proxy
 */

// ============================================================
// Song API Response
// ============================================================

/**
 * Song API Response
 * Note: This is the flattened response returned by API endpoints
 * Backend joins Song + File + Library to create this flat structure
 */
export interface Song {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  year: number | null;
  genre: string | null;
  trackNumber: number | null;
  discNumber: number | null;
  composer: string | null;
  fileId: string;
  libraryId: string;
  // Computed fields (from relations)
  libraryName: string | null;  // From library.name
  duration: number | null;     // From file.duration
  mimeType: string | null;     // From file.mimeType
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
}

// ============================================================
// Song Input Types
// ============================================================

export interface UpdateSongInput {
  title?: string;
  artist?: string | null;
  album?: string | null;
  albumArtist?: string | null;
  year?: number | null;
  genre?: string | null;
  trackNumber?: number | null;
  discNumber?: number | null;
  composer?: string | null;
}

// ============================================================
// Song Query Types
// ============================================================

export type SongSortOption = 
  | 'date-desc'      // Date added (newest first) - DEFAULT
  | 'date-asc'       // Date added (oldest first)
  | 'title-asc'      // Title A-Z (Pinyin for Chinese)
  | 'title-desc'     // Title Z-A
  | 'artist-asc'     // Artist A-Z
  | 'album-asc';     // Album A-Z

export interface SongSearchParams {
  q?: string;          // Search query
  libraryId?: string;  // Filter by Library
  sort?: SongSortOption;
}

// ============================================================
// Song Operation Results
// ============================================================

/**
 * Count of playlists containing a song
 * Used by GET /api/songs/:id/playlist-count
 */
export interface SongPlaylistCount {
  count: number;
}
