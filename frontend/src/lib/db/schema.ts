/**
 * IndexedDB Schema with Dexie
 * Offline storage for user data (libraries, playlists, songs)
 * 
 * Structure:
 * - Core Entities: Library, Playlist, Song (extended from @m3w/shared)
 * - Join Tables: LibrarySongLink, PlaylistSongLink (for many-to-many relationships)
 * - Player State: PlayerPreferences, PlayerProgress
 * - Sync: SyncQueueItem (for offline mutations)
 */

import Dexie, { type EntityTable } from 'dexie';
import type { Library, Playlist, Song } from '@m3w/shared';

// ============================================================
// Core Entities (extended from @m3w/shared)
// ============================================================
export interface OfflineLibrary extends Library {
  _syncStatus?: 'synced' | 'pending' | 'conflict';
  _lastSyncedAt?: Date;
}

export interface OfflinePlaylist extends Playlist {
  _syncStatus?: 'synced' | 'pending' | 'conflict';
  _lastSyncedAt?: Date;
}

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
  _syncStatus?: 'synced' | 'pending' | 'conflict';
  _lastSyncedAt?: Date;
}

export interface OfflineSong extends Omit<Song, 'fileId'> {
  _syncStatus?: 'synced' | 'pending' | 'conflict';
  _lastSyncedAt?: Date;
  /** Audio stream URL (Guest: /guest/songs/:id/stream, Auth: /api/songs/:id/stream) */
  streamUrl?: string;
  /** Cache status fields */
  isCached: boolean;
  cacheSize?: number;
  lastCacheCheck: number;
  /** File reference (links to OfflineFile entity for deduplication) */
  fileId: string;  // Required, aligned with backend Song.fileId
  /** File hash for deduplication (kept for quick lookup without join) */
  fileHash?: string;
  /**
   * Note: Song belongs to one Library (one-to-many relationship).
   * Each upload creates a new Song with unique id, even if fileId is shared.
   * Multiple songs can reference the same File (via fileId) for deduplication.
   */
}

// ============================================================
// Join Tables (for ordering and many-to-many relationships)
// ============================================================

// Playlist-Song relationship (join table for ordering)
// Aligned with backend Prisma PlaylistSong model
export interface PlaylistSongLink {
  id: string;
  playlistId: string;
  songId: string;
  order: number;
  addedAt: Date;
  _syncStatus?: 'synced' | 'pending' | 'conflict';
  _lastSyncedAt?: Date;
}

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
// Sync Queue (for offline mutations)
// ============================================================

// Sync queue for offline changes (future use)
export interface SyncQueueItem {
  id?: number;
  entityType: 'library' | 'playlist' | 'song' | 'playlistSong';
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  data?: unknown;
  createdAt: Date;
  retryCount: number;
  error?: string;
}

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
  playlistSongs!: EntityTable<PlaylistSongLink, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;
  playerPreferences!: EntityTable<PlayerPreferences, 'userId'>;
  playerProgress!: EntityTable<PlayerProgress, 'userId'>;

  constructor() {
    super('m3w-offline');

    // Schema with File entity for proper deduplication
    this.version(1).stores({
      libraries: 'id, userId, name, createdAt, _syncStatus',
      playlists: 'id, userId, linkedLibraryId, name, createdAt, _syncStatus',
      files: 'id, hash, size, refCount, _syncStatus',
      songs: 'id, libraryId, fileId, title, artist, album, fileHash, isCached, lastCacheCheck, _syncStatus',
      playlistSongs: 'id, playlistId, songId, [playlistId+songId], order, _syncStatus',
      syncQueue: '++id, entityType, entityId, operation, createdAt',
      playerPreferences: 'userId, updatedAt',
      playerProgress: 'userId, songId, contextType, contextId, updatedAt',
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
    db.syncQueue.clear(),
    db.playerPreferences.clear(),
    db.playerProgress.clear(),
  ]);
  
  // Reopen database to ensure consistent state after clearing all tables
  await db.close();
  await db.open();
}

export async function getSyncQueueSize(): Promise<number> {
  return await db.syncQueue.count();
}

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retryCount'>) {
  await db.syncQueue.add({
    ...item,
    createdAt: new Date(),
    retryCount: 0,
  });
}
