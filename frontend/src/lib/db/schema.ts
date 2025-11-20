/**
 * IndexedDB Schema with Dexie
 * Offline storage for user data (libraries, playlists, songs)
 */

import Dexie, { type EntityTable } from 'dexie';
import type { Library, Playlist, Song } from '@m3w/shared';

// Extend types for IndexedDB-specific fields
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
  /** @deprecated Use streamUrl instead. Audio files now stored in Cache Storage. */
  _audioBlob?: Blob; // Legacy field for backward compatibility
  streamUrl?: string; // Guest: /guest/songs/:id/stream, Auth: /api/songs/:id/stream
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

// Sync queue for offline changes
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

  constructor() {
    super('m3w-offline');

    // Version 1: Initial schema
    this.version(1).stores({
      libraries: 'id, userId, name, createdAt, _syncStatus',
      playlists: 'id, userId, name, createdAt, _syncStatus',
      songs: 'id, libraryId, title, artist, album, _syncStatus',
      playlistSongs: 'id, playlistId, songId, [playlistId+songId], order, _syncStatus',
      syncQueue: '++id, entityType, entityId, operation, createdAt',
    });

    // Version 2: Add linkedLibraryId index to playlists
    this.version(2).stores({
      playlists: 'id, userId, linkedLibraryId, name, createdAt, _syncStatus',
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
