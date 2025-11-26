/**
 * React Hook for PWA Features
 * 
 * Provides easy access to PWA status, storage quota, and caching operations
 */

import { useState, useEffect, useCallback } from 'react';
import { getPWAStatus, type PWAStatus } from '@/lib/pwa';
import { getStorageQuota, type StorageQuota, monitorStorageQuota } from '@/lib/storage/quota-manager';
import { cacheSong, cachePlaylist, cacheLibrary, isSongCached, getCachedSongs, type CacheProgress } from '@/lib/storage/audio-cache';
import { manualSync, type SyncResult } from '@/lib/sync/metadata-sync';

export function usePWAStatus() {
  const [status, setStatus] = useState<PWAStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPWAStatus().then((data) => {
      setStatus(data);
      setLoading(false);
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await getPWAStatus();
    setStatus(data);
    setLoading(false);
  }, []);

  return { status, loading, refresh };
}

export function useStorageQuota() {
  const [quota, setQuota] = useState<StorageQuota | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial load
    getStorageQuota().then((data) => {
      setQuota(data);
      setLoading(false);
    });

    // Monitor quota changes every 30 seconds
    const cleanup = monitorStorageQuota((data) => {
      setQuota(data);
    }, 30000);

    return cleanup;
  }, []);

  return { quota, loading };
}

export function useAudioCache() {
  const [cachedSongIds, setCachedSongIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<CacheProgress | null>(null);

  const refreshCachedSongs = useCallback(async () => {
    const songs = await getCachedSongs();
    setCachedSongIds(songs);
  }, []);

  // Load cached songs on mount
  useEffect(() => {
    refreshCachedSongs();
  }, [refreshCachedSongs]);

  const isCached = useCallback(
    (songId: string) => {
      return cachedSongIds.includes(songId);
    },
    [cachedSongIds]
  );

  const cacheSongById = useCallback(
    async (songId: string) => {
      setLoading(true);
      setProgress(null);

      try {
        await cacheSong(songId, (p) => setProgress(p));
        await refreshCachedSongs();
      } finally {
        setLoading(false);
        setProgress(null);
      }
    },
    [refreshCachedSongs]
  );

  const cachePlaylistById = useCallback(
    async (playlistId: string) => {
      setLoading(true);
      setProgress(null);

      try {
        await cachePlaylist(playlistId, (p) => setProgress(p));
        await refreshCachedSongs();
      } finally {
        setLoading(false);
        setProgress(null);
      }
    },
    [refreshCachedSongs]
  );

  const cacheLibraryById = useCallback(
    async (libraryId: string) => {
      setLoading(true);
      setProgress(null);

      try {
        await cacheLibrary(libraryId, (p) => setProgress(p));
        await refreshCachedSongs();
      } finally {
        setLoading(false);
        setProgress(null);
      }
    },
    [refreshCachedSongs]
  );

  return {
    cachedSongIds,
    isCached,
    loading,
    progress,
    cacheSong: cacheSongById,
    cachePlaylist: cachePlaylistById,
    cacheLibrary: cacheLibraryById,
    refresh: refreshCachedSongs,
  };
}

export function useMetadataSync() {
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await manualSync();
      setLastResult(result);
      return result;
    } finally {
      setSyncing(false);
    }
  }, []);

  return {
    syncing,
    lastResult,
    triggerSync,
  };
}

/**
 * Check if a song is cached (standalone version without state)
 */
export async function checkSongCached(songId: string): Promise<boolean> {
  return await isSongCached(songId);
}
