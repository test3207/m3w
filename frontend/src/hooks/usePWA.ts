/**
 * React Hook for PWA Features
 * 
 * Provides easy access to PWA status, storage quota, and caching operations
 */

import { useState, useEffect, useCallback } from "react";
import { getPWAStatus, type PWAStatus } from "@/lib/pwa";
import { getStorageQuota, type StorageQuota, monitorStorageQuota } from "@/lib/storage/quota-manager";
import { cacheSong, cachePlaylist, cacheLibrary, isSongCached, getCachedSongs, type CacheProgress } from "@/lib/storage/audio-cache";
import { manualSync, type SyncResult } from "@/lib/sync/metadata-sync";
import { logger } from "@/lib/logger-client";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Global state for install prompt (shared across components)
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const installPromptListeners = new Set<() => void>();
let listenersInitialized = false;

function notifyInstallPromptListeners() {
  installPromptListeners.forEach(fn => fn());
}

// Initialize listener once (guard prevents duplicate registration during HMR)
if (typeof window !== "undefined" && !listenersInitialized) {
  listenersInitialized = true;

  // HMR: Reset flag on module dispose to allow re-initialization
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      listenersInitialized = false;
    });
  }
  
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    logger.info("PWA install prompt available");
    notifyInstallPromptListeners();
  });

  window.addEventListener("appinstalled", () => {
    globalDeferredPrompt = null;
    logger.info("PWA installed");
    notifyInstallPromptListeners();
  });
}

/**
 * Hook for PWA installation
 */
export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(!!globalDeferredPrompt);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const listener = () => setCanInstall(!!globalDeferredPrompt);
    installPromptListeners.add(listener);
    // Sync initial state
    setCanInstall(!!globalDeferredPrompt);
    return () => {
      installPromptListeners.delete(listener);
    };
  }, []);

  const install = useCallback(async () => {
    if (!globalDeferredPrompt) return false;
    
    setInstalling(true);
    try {
      await globalDeferredPrompt.prompt();
      const { outcome } = await globalDeferredPrompt.userChoice;
      
      if (outcome === "accepted") {
        logger.info("User accepted PWA install");
        globalDeferredPrompt = null;
        notifyInstallPromptListeners();
        return true;
      } else {
        logger.info("User dismissed PWA install");
        return false;
      }
    } finally {
      setInstalling(false);
    }
  }, []);

  return { canInstall, installing, install };
}

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
