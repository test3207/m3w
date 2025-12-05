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
 * Sync Strategy: State-Based with Server-Wins
 * - _isDirty: true when local changes need to be pushed to server
 * - _isDeleted: true when entity was deleted locally (soft delete for sync)
 * - _lastModifiedAt: timestamp for conflict detection
 */

import Dexie, { type EntityTable, type Table } from 'dexie';
import type { Library, Playlist, Song, PlaylistSong, CacheOverride } from '@m3w/shared';
import { isGuestUser } from '../offline-proxy/utils';

// ============================================================
// Sync Tracking Fields (common to all syncable entities)
// ============================================================
/**
 * Note: Boolean fields should be queried using filter() instead of where().equals()
 * because IndexedDB boolean indexing behavior varies across environments.
 * Example: db.libraries.filter(e => e._isDirty === true).toArray()
 */
export interface SyncTrackingFields {
  /** True when local changes need to be pushed to server */
  _isDirty?: boolean;
  /** True when entity was deleted locally (soft delete for sync) */
  _isDeleted?: boolean;
  /** True when entity was created locally and hasn't been synced yet (needs ID mapping) */
  _isLocalOnly?: boolean;
  /** Timestamp of last local modification */
  _lastModifiedAt?: number;
}

// ============================================================
// Core Entities (extended from @m3w/shared)
// ============================================================

/**
 * Local cache policy override for this device
 * 'inherit' = follow backend setting, 'always' = always cache, 'never' = never cache
 */
export type LocalCacheOverride = CacheOverride;

export interface OfflineLibrary extends Library, SyncTrackingFields {
  /** Local device override for cache policy (not synced to server) */
  localCacheOverride?: LocalCacheOverride;
}

export interface OfflinePlaylist extends Playlist, SyncTrackingFields {}

/**
 * File entity for deduplication (aligned with backend Prisma File model)
 * Tracks physical audio files with reference counting for garbage collection
 */
export interface OfflineFile extends SyncTrackingFields {
  id: string;
  hash: string;          // SHA256 hash of file content
  size: number;          // File size in bytes
  mimeType: string;      // audio/mpeg, audio/flac, etc.
  duration?: number;     // Duration in seconds
  refCount: number;      // Number of songs referencing this file
  createdAt: Date;
}

export interface OfflineSong extends Omit<Song, 'fileId' | 'libraryName' | 'mimeType'>, SyncTrackingFields {
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
 * Offline PlaylistSong - extends shared PlaylistSong with sync tracking
 * Composite primary key: [playlistId, songId] (matches backend Prisma model)
 */
export interface OfflinePlaylistSong extends PlaylistSong, SyncTrackingFields {}

// ============================================================
// Player State (Guest mode only, Auth uses backend)
// ============================================================

// Player preferences (Guest mode only, Auth uses backend)
export interface PlayerPreferences {
  userId: string;
  volume: number;
  muted: boolean;
  repeatMode: 'off' | 'one' | 'all';
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
export type DownloadTiming = 'always' | 'wifi-only' | 'manual';

// ============================================================
// Database Class
// ============================================================

// Database class
export class M3WDatabase extends Dexie {
  // Tables
  libraries!: EntityTable<OfflineLibrary, 'id'>;
  playlists!: EntityTable<OfflinePlaylist, 'id'>;
  files!: EntityTable<OfflineFile, 'id'>;
  songs!: EntityTable<OfflineSong, 'id'>;
  // Use Table instead of EntityTable for composite primary key
  playlistSongs!: Table<OfflinePlaylistSong, [string, string]>;
  playerPreferences!: EntityTable<PlayerPreferences, 'userId'>;
  playerProgress!: EntityTable<PlayerProgress, 'userId'>;
  localSettings!: EntityTable<LocalSetting, 'key'>;

  constructor() {
    super('m3w-offline');

    // State-based sync schema (dirty tracking instead of sync queue)
    this.version(1).stores({
      libraries: 'id, userId, name, createdAt, _isDirty, _isDeleted, _isLocalOnly',
      playlists: 'id, userId, linkedLibraryId, name, createdAt, _isDirty, _isDeleted, _isLocalOnly',
      files: 'id, hash, size, refCount, _isDirty, _isDeleted',
      songs: 'id, libraryId, fileId, title, artist, album, fileHash, isCached, lastCacheCheck, _isDirty, _isDeleted, _isLocalOnly',
      playlistSongs: '[playlistId+songId], playlistId, songId, order, _isDirty, _isDeleted',
      playerPreferences: 'userId, updatedAt',
      playerProgress: 'userId, songId, contextType, contextId, updatedAt',
      localSettings: 'key, updatedAt',
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
  await Promise.all([
    db.libraries.clear(),
    db.playlists.clear(),
    db.files.clear(),
    db.songs.clear(),
    db.playlistSongs.clear(),
    db.playerPreferences.clear(),
    db.playerProgress.clear(),
  ]);
  
  // Reopen database to ensure consistent state after clearing all tables
  await db.close();
  await db.open();
}

/**
 * Get count of dirty entities that need to be synced
 * Note: Use filter() for boolean fields as IndexedDB boolean indexing varies by environment
 */
export async function getDirtyCount(): Promise<number> {
  const [libraries, playlists, songs, playlistSongs] = await Promise.all([
    db.libraries.filter(e => e._isDirty === true).count(),
    db.playlists.filter(e => e._isDirty === true).count(),
    db.songs.filter(e => e._isDirty === true).count(),
    db.playlistSongs.filter(e => e._isDirty === true).count(),
  ]);
  return libraries + playlists + songs + playlistSongs;
}

/**
 * Mark entity as dirty (needs sync)
 * Guest users never need sync, so _isDirty stays false for them.
 * @param isNew - True if this is a newly created entity (not yet on server)
 */
export function markDirty<T extends SyncTrackingFields>(entity: T, isNew = false): T {
  // Guest users don't need sync - their data is local only
  const shouldMarkDirty = !isGuestUser();
  return {
    ...entity,
    _isDirty: shouldMarkDirty,
    _isLocalOnly: isNew ? shouldMarkDirty : entity._isLocalOnly,
    _lastModifiedAt: Date.now(),
  };
}

/**
 * Mark entity as synced (no longer dirty, no longer local-only)
 */
export function markSynced<T extends SyncTrackingFields>(entity: T): T {
  return {
    ...entity,
    _isDirty: false,
    _isDeleted: false,
    _isLocalOnly: false,
    _lastModifiedAt: Date.now(),
  };
}

/**
 * Mark entity as deleted (soft delete for sync)
 * Guest users can hard delete immediately since they don't need sync.
 */
export function markDeleted<T extends SyncTrackingFields>(entity: T): T {
  // Guest users don't need sync - their data is local only
  const shouldMarkDirty = !isGuestUser();
  return {
    ...entity,
    _isDirty: shouldMarkDirty,
    _isDeleted: true,
    _lastModifiedAt: Date.now(),
  };
}

/**
 * Get all local-only entities (created offline, need server ID assignment)
 */
export async function getLocalOnlyEntities() {
  const [libraries, playlists, songs] = await Promise.all([
    db.libraries.where('_isLocalOnly').equals(1).toArray(),
    db.playlists.where('_isLocalOnly').equals(1).toArray(),
    db.songs.where('_isLocalOnly').equals(1).toArray(),
  ]);
  return { libraries, playlists, songs };
}

/**
 * Update entity ID after server assigns a new ID
 * Also updates all foreign key references
 */
export async function updateEntityId(
  table: 'libraries' | 'playlists' | 'songs',
  localId: string,
  serverId: string
): Promise<void> {
  await db.transaction('rw', [db.libraries, db.playlists, db.songs, db.playlistSongs], async () => {
    if (table === 'libraries') {
      // Get the library
      const library = await db.libraries.get(localId);
      if (!library) return;
      
      // Update songs that reference this library
      await db.songs.where('libraryId').equals(localId).modify({ libraryId: serverId });
      
      // Update playlists linked to this library
      await db.playlists.where('linkedLibraryId').equals(localId).modify({ linkedLibraryId: serverId });
      
      // Delete old, add new with server ID (use markSynced to clear all sync flags)
      await db.libraries.delete(localId);
      await db.libraries.add(markSynced({ ...library, id: serverId }));
      
    } else if (table === 'playlists') {
      const playlist = await db.playlists.get(localId);
      if (!playlist) return;
      
      // Update playlistSongs that reference this playlist
      await db.playlistSongs.where('playlistId').equals(localId).modify({ playlistId: serverId });
      
      // Delete old, add new with server ID (use markSynced to clear all sync flags)
      await db.playlists.delete(localId);
      await db.playlists.add(markSynced({ ...playlist, id: serverId }));
      
    } else if (table === 'songs') {
      const song = await db.songs.get(localId);
      if (!song) return;
      
      // Update playlistSongs that reference this song
      await db.playlistSongs.where('songId').equals(localId).modify({ songId: serverId });
      
      // Delete old, add new with server ID (use markSynced to clear all sync flags)
      await db.songs.delete(localId);
      await db.songs.add(markSynced({ ...song, id: serverId }));
    }
  });
}
