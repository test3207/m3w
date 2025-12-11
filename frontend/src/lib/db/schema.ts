/**
 * IndexedDB Schema with Dexie
 * Offline storage for user data (libraries, playlists, songs)
 * 
 * Structure:
 * - Core Entities: Library, Playlist, Song (extended from @m3w/shared)
 * - Join Tables: PlaylistSong (composite key [playlistId, songId])
 * - Player State: PlayerPreferences, PlayerProgress
 * - Local Settings: LocalSetting (device-specific preferences)
 * 
 * Storage Strategy:
 * - Guest users: Full local CRUD, all data in IndexedDB
 * - Auth users: Backend is source of truth
 *   - Online: Direct API calls, IndexedDB as read cache
 *   - Offline: Read-only from IndexedDB cache
 */

import Dexie, { type EntityTable, type Table } from "dexie";
import { RepeatMode, type Library, type Playlist, type Song, type PlaylistSong, type CacheOverride } from "@m3w/shared";

// ============================================================
// Core Entities (extended from @m3w/shared)
// ============================================================

/**
 * Local cache policy override for this device
 * 'inherit' = follow backend setting, 'always' = always cache, 'never' = never cache
 */
export type LocalCacheOverride = CacheOverride;

export interface OfflineLibrary extends Library {
  /** Local device override for cache policy (not synced to server) */
  localCacheOverride?: LocalCacheOverride;
}

export type OfflinePlaylist = Playlist;

/**
 * File entity for deduplication (aligned with backend Prisma File model)
 * Tracks physical audio files with reference counting for garbage collection
 */
export interface OfflineFile {
  id: string;
  hash: string;          // SHA256 hash of file content
  size: number;          // File size in bytes
  mimeType: string;      // audio/mpeg, audio/flac, etc.
  duration?: number;     // Duration in seconds
  refCount: number;      // Number of songs referencing this file
  createdAt: Date;
}

export interface OfflineSong extends Omit<Song, "fileId" | "libraryName" | "mimeType"> {
  /** Audio stream URL (/api/songs/:id/stream) */
  streamUrl?: string;
  /** Cache status fields */
  isCached: boolean;
  cacheSize?: number;
  lastCacheCheck: number;
  /** File reference (links to OfflineFile entity for deduplication) */
  fileId: string;  // Required, aligned with backend Song.fileId
  /** File hash for deduplication (kept for quick lookup without join) */
  fileHash?: string;
  /** Library name (computed from library relation, may be null if not joined) */
  libraryName?: string | null;
  /** MIME type (from file relation, may be null if not joined) */
  mimeType?: string | null;
  /**
   * Note: Song belongs to one Library (one-to-many relationship).
   * Each upload creates a new Song with unique id, even if fileId is shared.
   * Multiple songs can reference the same File (via fileId) for deduplication.
   */
}

// ============================================================
// Join Tables (for ordering and many-to-many relationships)
// ============================================================

/**
 * Offline PlaylistSong - same as shared PlaylistSong
 * Composite primary key: [playlistId, songId] (matches backend Prisma model)
 */
export type OfflinePlaylistSong = PlaylistSong;

// ============================================================
// Player State (Guest mode only, Auth uses backend)
// ============================================================

// Player preferences (Guest mode only, Auth uses backend)
export interface PlayerPreferences {
  userId: string;
  volume: number;
  muted: boolean;
  repeatMode: RepeatMode;
  shuffleEnabled: boolean;
  updatedAt: Date;
}

// Player progress (Guest mode only, Auth uses backend)
// Aligned with backend PlaybackProgress model
export interface PlayerProgress {
  userId: string;
  songId: string;
  position: number;
  duration: number;
  contextType?: string;   // 'library' | 'playlist' (playback context)
  contextId?: string;     // Library/Playlist ID
  contextName?: string;   // Library/Playlist name for display
  updatedAt: Date;
}

// ============================================================
// Local Settings (device-specific, not synced)
// ============================================================

/**
 * Local device settings (not synced to server)
 * Used for device-specific preferences like cache policy
 */
export interface LocalSetting {
  /** Setting key (primary key) */
  key: string;
  /** Setting value (JSON stringified for complex values) */
  value: string;
  /** Last updated timestamp */
  updatedAt: Date;
}

/** Download timing policy */
export type DownloadTiming = "always" | "wifi-only" | "manual";

// ============================================================
// Database Class
// ============================================================

// Database class
export class M3WDatabase extends Dexie {
  // Tables
  libraries!: EntityTable<OfflineLibrary, "id">;
  playlists!: EntityTable<OfflinePlaylist, "id">;
  files!: EntityTable<OfflineFile, "id">;
  songs!: EntityTable<OfflineSong, "id">;
  // Use Table instead of EntityTable for composite primary key
  playlistSongs!: Table<OfflinePlaylistSong, [string, string]>;
  playerPreferences!: EntityTable<PlayerPreferences, "userId">;
  playerProgress!: EntityTable<PlayerProgress, "userId">;
  localSettings!: EntityTable<LocalSetting, "key">;

  constructor() {
    super("m3w-offline");

    // Schema v1: Simple cache storage (no sync tracking)
    // Guest users: Full local CRUD, all data in IndexedDB
    // Auth users: Backend is source of truth, IndexedDB is read cache
    // Note: If schema changes during development, clear local data manually
    this.version(1).stores({
      libraries: "id, userId, name, createdAt",
      playlists: "id, userId, linkedLibraryId, name, createdAt",
      files: "id, hash, size, refCount",
      songs: "id, libraryId, fileId, title, artist, album, fileHash, isCached, lastCacheCheck",
      playlistSongs: "[playlistId+songId], playlistId, songId, order",
      playerPreferences: "userId, updatedAt",
      playerProgress: "userId, songId, contextType, contextId, updatedAt",
      localSettings: "key, updatedAt",
    });
  }
}

// ============================================================
// Database Instance & Helper Functions
// ============================================================

// Singleton instance
export const db = new M3WDatabase();

// Helper functions
export async function clearAllData() {
  // Delete entire database (including schema), Dexie will recreate on next open
  await db.delete();
  await db.open();
}
