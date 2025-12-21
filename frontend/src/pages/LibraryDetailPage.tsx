/**
 * Library Detail Page (Mobile-First)
 * Display songs in a library with playback controls
 * Supports multi-select mode for batch operations
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLibraryStore } from "@/stores/libraryStore";
import { usePlayerStore } from "@/stores/playerStore";
import { usePlaylistStore } from "@/stores/playlistStore";
import { useUIStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { ListPlus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { I18n } from "@/locales/i18n";
import { api } from "@/services";
import { eventBus, EVENTS, type SongCachedPayload } from "@/lib/events";
import { getLibraryDisplayName } from "@/lib/utils/defaults";
import { isDefaultLibrary } from "@m3w/shared";
import type { Song, SongSortOption } from "@m3w/shared";
import { logger } from "@/lib/logger-client";
import { getLibraryCacheStats, queueLibraryDownload } from "@/lib/storage/download-manager";
import { isSongCached, isAudioCacheAvailable } from "@/lib/storage/audio-cache";
import { useCanWrite } from "@/hooks/useCanWrite";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { SongListItem } from "@/components/features/libraries/SongListItem";
import { SelectionModeHeader } from "@/components/features/libraries/SelectionModeHeader";
import { LibraryActionBar } from "@/components/features/libraries/LibraryActionBar";

export default function LibraryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Check if guest user - cache UI hidden for guests
  const isGuest = useAuthStore((state) => state.isGuest);
  
  // Check if writes are allowed (for disabling upload/delete when offline)
  const { canWrite, disabledReason } = useCanWrite();
  const { isOnline } = useNetworkStatus();

  const [songs, setSongs] = useState<Song[]>([]);
  const [sortOption, setSortOption] = useState<SongSortOption>("date-desc");
  const [isLoadingSongs, setIsLoadingSongs] = useState(false);
  
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [songToDelete, setSongToDelete] = useState<{ id: string; title: string } | null>(null);

  // Cache state
  const [cacheStats, setCacheStats] = useState({ total: 0, cached: 0, percentage: 0 });
  const [songCacheStatus, setSongCacheStatus] = useState<Record<string, boolean>>({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [cacheAvailable, setCacheAvailable] = useState(false);



  const { currentLibrary, isLoading, fetchLibraryById, fetchLibraries } = useLibraryStore();
  const playFromLibrary = usePlayerStore((state) => state.playFromLibrary);
  const fetchPlaylists = usePlaylistStore((state) => state.fetchPlaylists);
  
  // Selection mode state from uiStore
  const isSelectionMode = useUIStore((state) => state.isSelectionMode);
  const selectedSongs = useUIStore((state) => state.selectedSongs);
  const enterSelectionMode = useUIStore((state) => state.enterSelectionMode);
  const exitSelectionMode = useUIStore((state) => state.exitSelectionMode);
  const toggleSongSelection = useUIStore((state) => state.toggleSongSelection);
  const selectAllSongs = useUIStore((state) => state.selectAllSongs);
  const openAddToPlaylistSheet = useUIStore((state) => state.openAddToPlaylistSheet);
  const openFullPlayer = useUIStore((state) => state.openFullPlayer);
  const openUploadDrawer = useUIStore((state) => state.openUploadDrawer);

  // Check if a song is selected
  const isSongSelected = (songId: string) => selectedSongs.some(s => s.id === songId);

  // Effect 1: Fetch library when ID changes
  useEffect(() => {
    const fetchLibrary = async () => {
      if (!id) {
        navigate("/libraries");
        return;
      }

      try {
        const library = await fetchLibraryById(id);
        if (!library) {
          toast({
            variant: "destructive",
            title: I18n.common.errorLabel,
            description: I18n.error.libraryNotFound,
          });
          navigate("/libraries");
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: I18n.common.errorLabel,
          description: error instanceof Error ? error.message : I18n.error.genericTryAgain,
        });
        navigate("/libraries");
      }
    };

    void fetchLibrary();
  }, [id, navigate, toast, fetchLibraryById]);

  // Effect 2: Fetch songs when ID or sort option changes
  useEffect(() => {
    const fetchSongs = async () => {
      if (!id) return;

      setIsLoadingSongs(true);
      try {
        const songsData = await api.main.libraries.getSongs(id, sortOption);
        setSongs(songsData);
      } catch (error) {
        logger.error("[LibraryDetailPage] Failed to fetch songs:", error);
      } finally {
        setIsLoadingSongs(false);
      }
    };

    void fetchSongs();
  }, [id, sortOption]);

  // Effect 3: Exit selection mode when navigating away
  useEffect(() => {
    return () => {
      exitSelectionMode();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect 4: Check cache availability
  useEffect(() => {
    isAudioCacheAvailable().then(setCacheAvailable);
  }, []);

  // Callback to load cache stats
  const loadCacheStats = useCallback(async () => {
    if (!id || songs.length === 0) return;
    
    try {
      const stats = await getLibraryCacheStats(songs);
      setCacheStats(stats);

      const statusMap: Record<string, boolean> = {};
      await Promise.all(
        songs.map(async (song) => {
          statusMap[song.id] = await isSongCached(song.id);
        })
      );
      setSongCacheStatus(statusMap);
    } catch (error) {
      logger.error("[LibraryDetailPage] Failed to load cache stats:", error);
    }
  }, [id, songs]);

  // Effect 5: Load cache stats when songs change
  useEffect(() => {
    void loadCacheStats();
  }, [loadCacheStats]);

  // Effect 6: Subscribe to SONG_CACHED events
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    
    const unsubscribe = eventBus.on<SongCachedPayload>(EVENTS.SONG_CACHED, (payload) => {
      if (payload?.libraryId !== id) return;
      
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void loadCacheStats();
      }, 500);
    });
    
    return () => {
      unsubscribe();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [loadCacheStats, id]);

  // Handle download all
  const handleDownloadAll = useCallback(async () => {
    if (!id || isDownloading) return;
    
    setIsDownloading(true);
    try {
      const queued = await queueLibraryDownload(id, true);
      if (queued > 0) {
        toast({
          title: I18n.libraries.detail.cache.downloadStarted,
          description: I18n.libraries.detail.cache.downloadStartedDesc.replace("{0}", String(queued)),
        });
      } else {
        toast({ title: I18n.libraries.detail.cache.allCached });
      }
    } catch (error) {
      logger.error("[LibraryDetailPage] Failed to start download:", error);
      toast({
        variant: "destructive",
        title: I18n.error.title,
        description: error instanceof Error ? error.message : I18n.error.genericTryAgain,
      });
    } finally {
      setIsDownloading(false);
    }
  }, [id, isDownloading, toast]);

  // Refresh songs when library songs count changes
  const [prevSongCount, setPrevSongCount] = useState<number | undefined>(undefined);
  const currentSongCount = currentLibrary?.songCount;
  
  useEffect(() => {
    if (
      id && 
      prevSongCount !== undefined && 
      currentSongCount !== undefined && 
      currentSongCount !== prevSongCount
    ) {
      const refetchSongs = async () => {
        try {
          const songsData = await api.main.libraries.getSongs(id, sortOption);
          setSongs(songsData);
        } catch (error) {
          logger.error("[LibraryDetailPage] Failed to refresh songs:", error);
        }
      };
      void refetchSongs();
    }
    
    setPrevSongCount(currentSongCount);
  }, [currentSongCount, id, sortOption, prevSongCount]);

  // Long press handler - enters selection mode
  const handleLongPress = (song: Song) => {
    if (isSelectionMode) return;
    enterSelectionMode({ id: song.id, title: song.title });
  };

  const handlePlayAll = () => {
    if (songs.length === 0 || !currentLibrary) return;
    const displayName = getLibraryDisplayName(currentLibrary);
    void playFromLibrary(currentLibrary.id, displayName, songs, 0);
    openFullPlayer();
    toast({
      title: I18n.playback.startPlayingTitle,
      description: I18n.playback.startPlayingDescription.replace("{0}", displayName),
    });
  };

  const handleSongClick = (song: Song, index: number) => {
    if (isSelectionMode) {
      toggleSongSelection({ id: song.id, title: song.title });
    } else {
      if (!currentLibrary) return;
      const displayName = getLibraryDisplayName(currentLibrary);
      void playFromLibrary(currentLibrary.id, displayName, songs, index);
      openFullPlayer();
    }
  };

  const handleSelectAll = () => {
    selectAllSongs(songs.map(song => ({ id: song.id, title: song.title })));
  };

  const handleBatchAddToPlaylist = () => {
    if (selectedSongs.length === 0) return;
    openAddToPlaylistSheet();
  };

  const handleDeleteSong = async (songId: string, songTitle: string) => {
    if (!id) return;

    try {
      await api.main.songs.delete(songId, id);
      setSongs(songs.filter((s) => s.id !== songId));
      await fetchLibraryById(id);
      await fetchLibraries();
      await fetchPlaylists();
      eventBus.emit(EVENTS.SONG_DELETED);

      toast({
        title: I18n.library.detail.deleteSong.successTitle,
        description: I18n.library.detail.deleteSong.successDescription.replace("{0}", songTitle),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: I18n.library.detail.deleteSong.errorTitle,
        description: error instanceof Error ? error.message : I18n.library.detail.deleteSong.unknownError,
      });
    }
  };

  const confirmDeleteSong = () => {
    if (songToDelete) {
      handleDeleteSong(songToDelete.id, songToDelete.title);
      setSongToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const getSortLabel = (option: SongSortOption): string => {
    const labels: Record<SongSortOption, string> = {
      "date-desc": I18n.library.detail.sortDateDesc,
      "date-asc": I18n.library.detail.sortDateAsc,
      "title-asc": I18n.library.detail.sortTitleAsc,
      "title-desc": I18n.library.detail.sortTitleDesc,
      "artist-asc": I18n.library.detail.sortArtistAsc,
      "album-asc": I18n.library.detail.sortAlbumAsc,
    };
    return labels[option];
  };

  if (isLoading || !currentLibrary) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">{I18n.library.detail.loadingLabel}</p>
      </div>
    );
  }

  const showCacheUI = !isGuest && cacheAvailable;

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Selection Mode Header */}
      {isSelectionMode && (
        <SelectionModeHeader
          selectedSongs={selectedSongs}
          onExit={exitSelectionMode}
          onSelectAll={handleSelectAll}
          onAddToPlaylist={handleBatchAddToPlaylist}
        />
      )}

      {/* Header */}
      <div className={cn("mb-4", isSelectionMode && "mt-16")}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          {getLibraryDisplayName(currentLibrary)}
          {isDefaultLibrary(currentLibrary) && (
            <span className="text-sm bg-primary/10 text-primary px-2 py-1 rounded">
              {I18n.defaults.library.badge}
            </span>
          )}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {I18n.libraries.detail.songsCount.replace("{0}", String(songs.length))}
          {showCacheUI && cacheStats.total > 0 && (
            <span className="ml-2">
              · {I18n.libraries.detail.cache.cachedCount
                .replace("{0}", String(cacheStats.cached))
                .replace("{1}", String(cacheStats.total))}
            </span>
          )}
        </p>
      </div>

      {/* Actions */}
      <LibraryActionBar
        songsCount={songs.length}
        isSelectionMode={isSelectionMode}
        isDownloading={isDownloading}
        showDownloadButton={showCacheUI}
        canWrite={canWrite}
        disabledReason={disabledReason}
        sortOption={sortOption}
        onPlayAll={handlePlayAll}
        onDownloadAll={handleDownloadAll}
        onUpload={() => openUploadDrawer(id)}
        onEnterSelectionMode={() => enterSelectionMode()}
        onSortChange={setSortOption}
      />

      {/* Current Sort */}
      <p className="mb-4 text-xs text-muted-foreground">
        {I18n.libraries.detail.sort.label.replace("{0}", getSortLabel(sortOption))}
        {isLoadingSongs && ` (${I18n.common.loadingLabel})`}
      </p>

      {/* Song List */}
      {songs.length === 0 && !isLoadingSongs ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center">
            <ListPlus className="mx-auto h-16 w-16 text-muted-foreground/50" />
            <h2 className="mt-4 text-xl font-semibold">{I18n.libraries.detail.empty.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{I18n.libraries.detail.empty.description}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2 pb-32">
          {songs.map((song, index) => (
            <SongListItem
              key={song.id}
              song={song}
              index={index}
              isSelectionMode={isSelectionMode}
              isSelected={isSongSelected(song.id)}
              isCached={songCacheStatus[song.id] ?? false}
              showCacheStatus={showCacheUI}
              shouldDim={!isGuest && !isOnline && !(songCacheStatus[song.id] ?? false)}
              canWrite={canWrite}
              onLongPress={handleLongPress}
              onClick={handleSongClick}
              onAddToPlaylist={(s) => openAddToPlaylistSheet({ id: s.id, title: s.title })}
              onDelete={(s) => {
                setSongToDelete({ id: s.id, title: s.title });
                setDeleteDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{I18n.libraries.detail.deleteSong.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {songToDelete
                ? I18n.libraries.detail.deleteSong.confirmDescription.replace("{0}", songToDelete.title)
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{I18n.common.cancelButton}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSong}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {I18n.common.deleteButton}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
