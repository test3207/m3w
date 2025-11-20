/**
 * IndexedDB Schema with Dexie
 * Offline storage for user data (libraries, playlists, songs)
 */

import Dexie, { type EntityTable } from 'dexie';
import type { Library, Playlist, Song } from '@m3w/shared';

// Extend shared types with IndexedDB-specific fields
export interface OfflineLibrary extends Library {
  _syncStatus?: 'synced' | 'pending' | 'conflict';
  _lastSyncedAt?: Date;
}

export interface OfflinePlaylist extends Playlist {
  _syncStatus?: 'synced' | 'pending' | 'conflict';
  _lastSyncedAt?: Date;
}

export interface OfflineSong extends Song {
  _syncStatus?: 'synced' | 'pending' | 'conflict';
  _lastSyncedAt?: Date;
  /** Audio stream URL (Guest: /guest/songs/:id/stream, Auth: /api/songs/:id/stream) */
  streamUrl?: string;
  /** Cache status fields */
  isCached: boolean;
  cacheSize?: number;
  lastCacheCheck: number;
  /** File hash for deduplication */
  fileHash: string;
  /**
   * Primary library ID where song was first uploaded.
   * Song can exist in multiple libraries via librarySongs join table.
   * Matches server Prisma schema design.
   */
  // libraryId inherited from Song interface
}

// Playlist-Song relationship (for ordering)
// Aligned with backend Prisma PlaylistSong model
export interface OfflinePlaylistSong {
  id: string;
  playlistId: string;
  songId: string;
  order: number;
  addedAt: Date;
  _syncStatus?: 'synced' | 'pending' | 'conflict';
  _lastSyncedAt?: Date;
}

// Library-Song relationship (many-to-many)
export interface OfflineLibrarySong {
  id: string;
  libraryId: string;
  songId: string;
  addedAt: Date;
  _syncStatus?: 'synced' | 'pending' | 'conflict';
  _lastSyncedAt?: Date;
}

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
export interface PlayerProgress {
  userId: string;
  songId: string;
  position: number;
  duration: number;
  updatedAt: Date;
}

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

// Database class
export class M3WDatabase extends Dexie {
  // Tables
  libraries!: EntityTable<OfflineLibrary, 'id'>;
  playlists!: EntityTable<OfflinePlaylist, 'id'>;
  songs!: EntityTable<OfflineSong, 'id'>;
  librarySongs!: EntityTable<OfflineLibrarySong, 'id'>;
  playlistSongs!: EntityTable<OfflinePlaylistSong, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;
  playerPreferences!: EntityTable<PlayerPreferences, 'userId'>;
  playerProgress!: EntityTable<PlayerProgress, 'userId'>;

  constructor() {
    super('m3w-offline');

    // Version 1: Initial schema (kept for reference)
    this.version(1).stores({
      libraries: 'id, userId, name, createdAt, _syncStatus',
      playlists: 'id, userId, linkedLibraryId, name, createdAt, _syncStatus',
      songs: 'id, libraryId, title, artist, album, _syncStatus',
      playlistSongs: 'id, playlistId, songId, [playlistId+songId], order, _syncStatus',
      syncQueue: '++id, entityType, entityId, operation, createdAt',
      playerPreferences: 'userId, updatedAt',
      playerProgress: 'userId, songId, updatedAt',
    });

    // Version 2: Add multi-library support and cache management
    // Aligned with backend Prisma schema (no fromLibraryId in PlaylistSong)
    this.version(2).stores({
      libraries: 'id, userId, name, createdAt, _syncStatus',
      playlists: 'id, userId, linkedLibraryId, name, createdAt, _syncStatus',
      songs: 'id, libraryId, title, artist, album, fileHash, isCached, lastCacheCheck, _syncStatus',
      librarySongs: 'id, libraryId, songId, [libraryId+songId], addedAt, _syncStatus',
      playlistSongs: 'id, playlistId, songId, [playlistId+songId], order, _syncStatus',
      syncQueue: '++id, entityType, entityId, operation, createdAt',
      playerPreferences: 'userId, updatedAt',
      playerProgress: 'userId, songId, updatedAt',
    }).upgrade(async (tx) => {
      // Migration logic: Create librarySongs entries for existing songs
      // libraryId is KEPT as primary library reference (matches server Prisma)
      const songs = await tx.table('songs').toArray();
      const librarySongs: OfflineLibrarySong[] = [];

      for (const song of songs as OfflineSong[]) {
        if (song.libraryId) {
          // Create librarySongs entry for many-to-many relationship
          // libraryId is KEPT in song table as primary library reference
          librarySongs.push({
            id: `${song.libraryId}-${song.id}`,
            libraryId: song.libraryId,
            songId: song.id,
            addedAt: new Date(),
            _syncStatus: song._syncStatus,
            _lastSyncedAt: song._lastSyncedAt,
          });

          // Update song: remove libraryId, add cache fields
          await tx.table('songs').update(song.id, {
            libraryId: undefined,
            isCached: false,
            cacheSize: undefined,
            lastCacheCheck: Date.now(),
            fileHash: song.id, // Use id as fallback hash for existing songs
          });
        }
      }

      // Bulk insert librarySongs
      await tx.table('librarySongs').bulkAdd(librarySongs);

      // Update playlistSongs: add fromLibraryId (use first library as default)
      type OldPlaylistSong = OfflinePlaylistSong & { songId?: string };
      const playlistSongs = await tx.table('playlistSongs').toArray();
      
      for (const ps of playlistSongs as OldPlaylistSong[]) {
        const librarySong = librarySongs.find(ls => ls.songId === ps.songId);
        if (librarySong) {
          await tx.table('playlistSongs').update(ps.id, {
            fromLibraryId: librarySong.libraryId,
          });
        }
      }
    });
  }
}

// Singleton instance
export const db = new M3WDatabase();

// Helper functions
export async function clearAllData() {
  await Promise.all([
    db.libraries.clear(),
    db.playlists.clear(),
    db.songs.clear(),
    db.librarySongs.clear(),
    db.playlistSongs.clear(),
    db.syncQueue.clear(),
    db.playerPreferences.clear(),
    db.playerProgress.clear(),
  ]);
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
