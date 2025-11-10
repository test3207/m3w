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
  _audioBlob?: Blob; // Cached audio file
}

// Sync queue for offline changes
export interface SyncQueueItem {
  id?: number;
  entityType: 'library' | 'playlist' | 'song';
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
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;

  constructor() {
    super('m3w-offline');

    this.version(1).stores({
      libraries: 'id, userId, name, createdAt, _syncStatus',
      playlists: 'id, userId, name, createdAt, _syncStatus',
      songs: 'id, libraryId, title, artist, album, _syncStatus',
      syncQueue: '++id, entityType, entityId, operation, createdAt',
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
