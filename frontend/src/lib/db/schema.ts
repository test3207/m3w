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
}

// Playlist-Song relationship (for ordering)
export interface OfflinePlaylistSong {
  id: string;
  playlistId: string;
  songId: string;
  order: number;
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
  playlistSongs!: EntityTable<OfflinePlaylistSong, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;
  playerPreferences!: EntityTable<PlayerPreferences, 'userId'>;
  playerProgress!: EntityTable<PlayerProgress, 'userId'>;

  constructor() {
    super('m3w-offline');

    // Single version schema (delete db manually for testing)
    this.version(1).stores({
      libraries: 'id, userId, name, createdAt, _syncStatus',
      playlists: 'id, userId, linkedLibraryId, name, createdAt, _syncStatus',
      songs: 'id, libraryId, title, artist, album, _syncStatus',
      playlistSongs: 'id, playlistId, songId, [playlistId+songId], order, _syncStatus',
      syncQueue: '++id, entityType, entityId, operation, createdAt',
      playerPreferences: 'userId, updatedAt',
      playerProgress: 'userId, songId, updatedAt',
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
