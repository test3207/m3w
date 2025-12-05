/**
 * Library Detail Page (Mobile-First)
 * Display songs in a library with playback controls
 * Supports multi-select mode for batch operations
 */

import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLibraryStore } from "@/stores/libraryStore";
import { usePlayerStore } from "@/stores/playerStore";
import { usePlaylistStore } from "@/stores/playlistStore";
import { useUIStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/button";
import {
  Play,
  ListPlus,
  ArrowUpDown,
  MoreVertical,
  Trash2,
  ListMusic,
  Check,
  X,
  CheckSquare,
  Upload,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { I18n } from "@/locales/i18n";
import { useLocale } from "@/locales/use-locale";
import { api } from "@/services";
import { eventBus, EVENTS } from "@/lib/events";
import { getLibraryDisplayName } from "@/lib/utils/defaults";
import { isDefaultLibrary } from "@m3w/shared";
import type { Song, SongSortOption } from "@m3w/shared";
import { formatDuration } from "@/lib/utils/format-duration";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

// Long press duration in milliseconds
const LONG_PRESS_DURATION = 500;

export default function LibraryDetailPage() {
  useLocale(); // Subscribe to locale changes
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [songs, setSongs] = useState<Song[]>([]);
  const [sortOption, setSortOption] = useState<SongSortOption>("date-desc");
  const [isLoadingSongs, setIsLoadingSongs] = useState(false);
  
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [songToDelete, setSongToDelete] = useState<{ id: string; title: string } | null>(null);

  // Long press state
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);

  // Cleanup long press timer on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const { currentLibrary, isLoading, fetchLibraryById, fetchLibraries } =
    useLibraryStore();
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
  const isSongSelected = (songId: string) => {
    return selectedSongs.some(s => s.id === songId);
  };

  // Effect 1: Fetch library when ID changes (NOT when sort changes)
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
          description:
            error instanceof Error ? error.message : I18n.error.genericTryAgain,
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
        console.error("Failed to fetch songs:", error);
      } finally {
        setIsLoadingSongs(false);
      }
    };

    void fetchSongs();
  }, [id, sortOption]);

  // Effect 3: Exit selection mode when navigating away (cleanup only on unmount)
  useEffect(() => {
    return () => {
      exitSelectionMode();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh songs when library songs count changes (after upload)
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
          console.error("Failed to refresh songs:", error);
        }
      };
      void refetchSongs();
    }
    
    setPrevSongCount(currentSongCount);
  }, [currentSongCount, id, sortOption, prevSongCount]);

  // Long press handlers
  const handlePressStart = (song: Song) => {
    if (isSelectionMode) return; // Already in selection mode
    
    longPressTriggered.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      enterSelectionMode({
        id: song.id,
        title: song.title,
        coverUrl: song.coverUrl,
      });
    }, LONG_PRESS_DURATION);
  };

  const handlePressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePlayAll = () => {
    if (songs.length === 0 || !currentLibrary) return;
    const displayName = getLibraryDisplayName(currentLibrary);
    void playFromLibrary(currentLibrary.id, displayName, songs, 0);
    openFullPlayer();
    toast({
      title: I18n.playback.startPlayingTitle,
      description: I18n.playback.startPlayingDescription.replace(
        "{0}",
        displayName
      ),
    });
  };

  const handleSongClick = (song: Song, index: number) => {
    // If long press was triggered, don't handle click
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }

    if (isSelectionMode) {
      // Toggle selection
      toggleSongSelection({
        id: song.id,
        title: song.title,
        coverUrl: song.coverUrl,
      });
    } else {
      // Play song and open full player
      if (!currentLibrary) return;
      const displayName = getLibraryDisplayName(currentLibrary);
      void playFromLibrary(currentLibrary.id, displayName, songs, index);
      openFullPlayer();
    }
  };

  const handleSelectAll = () => {
    selectAllSongs(
      songs.map(song => ({
        id: song.id,
        title: song.title,
        coverUrl: song.coverUrl,
      }))
    );
  };

  const handleBatchAddToPlaylist = () => {
    if (selectedSongs.length === 0) return;
    openAddToPlaylistSheet();
  };

  const handleDeleteSong = async (songId: string, songTitle: string) => {
    if (!id) return;

    try {
      await api.main.songs.delete(songId, id);

      // Remove from local state
      setSongs(songs.filter((s) => s.id !== songId));

      // Refresh data
      await fetchLibraryById(id);
      await fetchLibraries();
      await fetchPlaylists();

      // Emit event to notify other components
      eventBus.emit(EVENTS.SONG_DELETED);

      toast({
        title: I18n.library.detail.deleteSong.successTitle,
        description: I18n.library.detail.deleteSong.successDescription.replace('{0}', songTitle),
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
        <p className="text-muted-foreground">
          {I18n.library.detail.loadingLabel}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Selection Mode Header */}
      {isSelectionMode && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-primary p-4 text-primary-foreground shadow-md border-b border-primary-foreground/20">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/20"
              onClick={exitSelectionMode}
            >
              <X className="h-5 w-5" />
            </Button>
            <span className="font-medium">
              {I18n.libraries.detail.selection.selectedCount.replace('{0}', String(selectedSongs.length))}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:bg-primary-foreground/20"
              onClick={handleSelectAll}
            >
              <CheckSquare className="mr-1 h-4 w-4" />
              {I18n.libraries.detail.selection.selectAll}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={selectedSongs.length === 0}
              onClick={handleBatchAddToPlaylist}
            >
              <ListMusic className="mr-1 h-4 w-4" />
              {I18n.libraries.detail.selection.addToPlaylist}
            </Button>
          </div>
        </div>
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
          {I18n.libraries.detail.songsCount.replace('{0}', String(songs.length))}
        </p>
      </div>

      {/* Actions */}
      <div className="mb-4 flex gap-2">
        <Button
          onClick={handlePlayAll}
          disabled={songs.length === 0 || isSelectionMode}
          className="flex-1"
        >
          <Play className="mr-2 h-4 w-4" />
          {I18n.libraries.detail.playAll}
        </Button>

        <Button
          variant="outline"
          disabled={isSelectionMode}
          onClick={() => openUploadDrawer(id)}
        >
          <Upload className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          disabled={songs.length === 0 || isSelectionMode}
          onClick={() => enterSelectionMode()}
        >
          <ListMusic className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={isSelectionMode}>
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSortOption("date-desc")}>
              {sortOption === "date-desc" && "✓ "}
              {I18n.libraries.detail.sort.dateDesc}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption("date-asc")}>
              {sortOption === "date-asc" && "✓ "}
              {I18n.libraries.detail.sort.dateAsc}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption("title-asc")}>
              {sortOption === "title-asc" && "✓ "}
              {I18n.libraries.detail.sort.titleAsc}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption("title-desc")}>
              {sortOption === "title-desc" && "✓ "}
              {I18n.libraries.detail.sort.titleDesc}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption("artist-asc")}>
              {sortOption === "artist-asc" && "✓ "}
              {I18n.libraries.detail.sort.artistAsc}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOption("album-asc")}>
              {sortOption === "album-asc" && "✓ "}
              {I18n.libraries.detail.sort.albumAsc}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Current Sort */}
      <p className="mb-4 text-xs text-muted-foreground">
        {I18n.libraries.detail.sort.label.replace('{0}', getSortLabel(sortOption))}
        {isLoadingSongs && ` (${I18n.common.loadingLabel})`}
      </p>

      {/* Song List */}
      {songs.length === 0 && !isLoadingSongs ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center">
            <ListPlus className="mx-auto h-16 w-16 text-muted-foreground/50" />
            <h2 className="mt-4 text-xl font-semibold">{I18n.libraries.detail.empty.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {I18n.libraries.detail.empty.description}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2 pb-32">
          {songs.map((song, index) => {
            const isSelected = isSongSelected(song.id);
            
            return (
              <div
                key={song.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors",
                  isSelectionMode && isSelected && "border-primary bg-primary/5",
                  isSelectionMode && "cursor-pointer"
                )}
                onMouseDown={() => handlePressStart(song)}
                onMouseUp={handlePressEnd}
                onMouseLeave={handlePressEnd}
                onTouchStart={() => handlePressStart(song)}
                onTouchEnd={handlePressEnd}
                onTouchCancel={handlePressEnd}
                onClick={() => handleSongClick(song, index)}
              >
                {/* Selection checkbox */}
                {isSelectionMode && (
                  <div
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground"
                    )}
                  >
                    {isSelected && <Check className="h-4 w-4" />}
                  </div>
                )}

                {/* Album Cover */}
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                  {song.coverUrl ? (
                    <img
                      src={song.coverUrl}
                      alt={song.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      ♪
                    </div>
                  )}
                </div>

                {/* Song Info */}
                <div className="flex-1 overflow-hidden">
                  <p className="truncate font-medium">{song.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {song.artist}
                    {song.album && ` • ${song.album}`}
                  </p>
                </div>

                {/* Duration */}
                {song.duration && !isSelectionMode && (
                  <div className="shrink-0 text-sm text-muted-foreground">
                    {formatDuration(song.duration)}
                  </div>
                )}

                {/* More Menu (hidden in selection mode) */}
                {!isSelectionMode && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          openAddToPlaylistSheet({
                            id: song.id,
                            title: song.title,
                            coverUrl: song.coverUrl,
                          });
                        }}
                      >
                        <ListMusic className="mr-2 h-4 w-4" />
                        {I18n.library.addToPlaylist.label}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setSongToDelete({ id: song.id, title: song.title });
                          setDeleteDialogOpen(true);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {I18n.libraries.detail.deleteSong.button}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {I18n.libraries.detail.deleteSong.confirmTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {songToDelete
                ? I18n.libraries.detail.deleteSong.confirmDescription.replace('{0}', songToDelete.title)
                : ''
              }
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
