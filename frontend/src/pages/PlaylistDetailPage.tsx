/**
 * PlaylistDetailPage (Mobile-First)
 * Displays playlist songs with playback and drag-to-reorder
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Play, Music } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { I18n } from "@/locales/i18n";
import { usePlaylistStore } from "@/stores/playlistStore";
import { usePlayerStore } from "@/stores/playerStore";
import { api } from "@/services";
import { logger } from "@/lib/logger-client";
import { useToast } from "@/components/ui/use-toast";
import { eventBus, EVENTS } from "@/lib/events";
import type { Song as SharedSong } from "@m3w/shared";
import { SortableSongItem } from "@/components/features/playlists/SortableSongItem";

export default function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    currentPlaylist,
    setCurrentPlaylist,
    reorderPlaylistSongs,
    removeSongFromPlaylist,
  } = usePlaylistStore();
  const { 
    playFromPlaylist, 
    currentSong, 
    queueSource, 
    queueSourceId,
    isShuffled,
    setQueue,
    currentIndex,
  } = usePlayerStore();

  const [songs, setSongs] = useState<SharedSong[]>([]);
  const [loading, setLoading] = useState(true);

  // Configure drag sensors
  // TouchSensor: delay 250ms for mobile long-press
  // PointerSensor: distance 10px to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch playlist data
  useEffect(() => {
    if (!id) {
      navigate("/playlists");
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const [playlistData, songsData] = await Promise.all([
          api.main.playlists.getById(id),
          api.main.playlists.getSongs(id),
        ]);

        setCurrentPlaylist(playlistData);
        setSongs(songsData);
      } catch (error) {
        logger.error("Failed to fetch playlist", { error, playlistId: id });
        toast({
          variant: "destructive",
          title: I18n.error.failedToGetPlaylists,
        });
        navigate("/playlists");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, setCurrentPlaylist, navigate, toast]);

  // Listen for external song changes (delete/upload)
  useEffect(() => {
    if (!id) return;

    const refetchSongs = async () => {
      try {
        logger.debug("[PlaylistDetailPage] Event triggered, refetching songs");
        const songsData = await api.main.playlists.getSongs(id);
        setSongs(songsData);
        logger.debug(
          "[PlaylistDetailPage] Songs refreshed due to external changes"
        );
      } catch (error) {
        logger.error("[PlaylistDetailPage] Failed to refresh songs:", error);
      }
    };

    const unsubscribeDelete = eventBus.on(EVENTS.SONG_DELETED, refetchSongs);
    const unsubscribeUpload = eventBus.on(EVENTS.SONG_UPLOADED, refetchSongs);

    return () => {
      unsubscribeDelete();
      unsubscribeUpload();
    };
  }, [id]);

  // Handle play all
  const handlePlayAll = () => {
    if (!currentPlaylist || songs.length === 0) return;

    playFromPlaylist(currentPlaylist.id, currentPlaylist.name, songs, 0);
    toast({
      title: `正在播放：${currentPlaylist.name}`,
    });
  };

  // Handle play single song
  const handlePlaySong = (index: number) => {
    if (!currentPlaylist) return;

    playFromPlaylist(currentPlaylist.id, currentPlaylist.name, songs, index);
  };

  // Handle drag end - reorder songs
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !currentPlaylist) {
      return;
    }

    const oldIndex = songs.findIndex((s) => s.id === active.id);
    const newIndex = songs.findIndex((s) => s.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Optimistically update UI
    const reorderedSongs = arrayMove(songs, oldIndex, newIndex);
    setSongs(reorderedSongs);

    // Build new songIds order
    const newSongIds = reorderedSongs.map((s) => s.id);

    // Persist to backend
    const success = await reorderPlaylistSongs(currentPlaylist.id, newSongIds);

    if (success) {
      // If currently playing this playlist in sequential mode, update queue
      if (
        queueSource === "playlist" &&
        queueSourceId === currentPlaylist.id &&
        !isShuffled
      ) {
        // Find the new index of the currently playing song
        const playingSongId = currentSong?.id;
        const newPlayingIndex = playingSongId
          ? reorderedSongs.findIndex((s) => s.id === playingSongId)
          : currentIndex;

        setQueue(reorderedSongs, newPlayingIndex >= 0 ? newPlayingIndex : 0);
      }

      toast({
        title: I18n.playlists.detail.moveSong.successTitle,
      });
    } else {
      // Revert on failure - refetch from server
      const serverSongs = await api.main.playlists.getSongs(currentPlaylist.id);
      setSongs(serverSongs);

      toast({
        variant: "destructive",
        title: I18n.playlists.detail.moveSong.errorTitle,
      });
    }
  };

  // Handle remove song
  const handleRemove = async (songId: string, songTitle: string) => {
    if (!currentPlaylist) return;

    const success = await removeSongFromPlaylist(currentPlaylist.id, songId);
    if (success) {
      // Update local state
      setSongs((prev) => prev.filter((s) => s.id !== songId));

      toast({
        title: I18n.playlists.detail.removeSong.successTitle.replace("{0}", songTitle),
      });
    } else {
      toast({
        variant: "destructive",
        title: I18n.playlists.detail.removeSong.errorTitle,
      });
    }
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    if (seconds === 0 || !seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{I18n.common.loadingLabel}</p>
      </div>
    );
  }

  if (!currentPlaylist) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{I18n.playlists.detail.notFound}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container flex h-14 items-center gap-3 px-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">
              {currentPlaylist.name}
            </h1>
            <p className="text-xs text-muted-foreground">
              {I18n.playlists.detail.songsCount.replace("{0}", String(songs.length))}
            </p>
          </div>

          {songs.length > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handlePlayAll}
              className="shrink-0"
            >
              <Play className="h-4 w-4 mr-1.5" />
              {I18n.playlists.detail.playAll}
            </Button>
          )}
        </div>
      </div>

      {/* Song List */}
      <div className="flex-1 overflow-auto">
        <div className="container px-4 py-4">
          {songs.length === 0 ? (
            <Card className="p-8">
              <div className="flex flex-col items-center justify-center gap-4 text-center">
                <Music className="h-12 w-12 text-muted-foreground/50" />
                <div>
                  <h3 className="font-semibold mb-1">{I18n.playlists.detail.empty.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {I18n.playlists.detail.addFromLibrary}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate("/libraries")}
                >
                  {I18n.playlists.detail.empty.browseButton}
                </Button>
              </div>
            </Card>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={songs.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {songs.map((song, index) => {
                    const isCurrentlyPlaying =
                      currentSong?.id === song.id &&
                      queueSource === "playlist" &&
                      queueSourceId === id;

                    return (
                      <SortableSongItem
                        key={song.id}
                        song={song}
                        index={index}
                        isCurrentlyPlaying={isCurrentlyPlaying}
                        onPlay={handlePlaySong}
                        onRemove={handleRemove}
                        formatDuration={formatDuration}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
}
