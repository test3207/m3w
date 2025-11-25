/**
 * PlaylistDetailPage (Mobile-First)
 * Displays playlist songs with playback and reordering
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Play, Music, ChevronUp, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { I18n } from "@/locales/i18n";
import { useLocale } from "@/locales/use-locale";
import { usePlaylistStore } from "@/stores/playlistStore";
import { usePlayerStore } from "@/stores/playerStore";
import { api } from "@/services";
import { logger } from "@/lib/logger-client";
import { useToast } from "@/components/ui/use-toast";
import { eventBus, EVENTS } from "@/lib/events";
import { cn } from "@/lib/utils";
import type { Song as SharedSong } from "@m3w/shared";

export default function PlaylistDetailPage() {
  useLocale();
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
        console.log("[PlaylistDetailPage] Event triggered, refetching songs");
        const songsData = await api.main.playlists.getSongs(id);
        setSongs(songsData);
        console.log(
          "[PlaylistDetailPage] Songs refreshed due to external changes"
        );
      } catch (error) {
        console.error("[PlaylistDetailPage] Failed to refresh songs:", error);
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

  // Handle move song up
  const handleMoveUp = async (index: number) => {
    if (index === 0 || !currentPlaylist) return;

    // Build songIds from current songs array (source of truth for display order)
    const currentSongIds = songs.map(s => s.id);
    const newSongIds = [...currentSongIds];
    [newSongIds[index - 1], newSongIds[index]] = [
      newSongIds[index],
      newSongIds[index - 1],
    ];

    const success = await reorderPlaylistSongs(currentPlaylist.id, newSongIds);
    if (success) {
      // Re-fetch to sync UI
      const updatedSongs = await api.main.playlists.getSongs(
        currentPlaylist.id
      );
      setSongs(updatedSongs);

      // If currently playing this playlist in sequential mode, update queue
      if (
        queueSource === 'playlist' && 
        queueSourceId === currentPlaylist.id && 
        !isShuffled
      ) {
        // Calculate new index for currently playing song
        let newIndex = currentIndex;
        
        // If moved the currently playing song, adjust index
        if (currentIndex === index) {
          newIndex = index - 1;
        } 
        // If moved a song from above the current song to below it
        else if (currentIndex === index - 1) {
          newIndex = index;
        }
        
        // Update the queue with the new order and adjusted index
        setQueue(updatedSongs, newIndex);
      }

      toast({
        title: I18n.playlists.detail.moveSong.successTitle,
      });
    } else {
      toast({
        variant: "destructive",
        title: I18n.playlists.detail.moveSong.errorTitle,
      });
    }
  };

  // Handle move song down
  const handleMoveDown = async (index: number) => {
    if (index === songs.length - 1 || !currentPlaylist) return;

    // Build songIds from current songs array (source of truth for display order)
    const currentSongIds = songs.map(s => s.id);
    const newSongIds = [...currentSongIds];
    [newSongIds[index], newSongIds[index + 1]] = [
      newSongIds[index + 1],
      newSongIds[index],
    ];

    const success = await reorderPlaylistSongs(currentPlaylist.id, newSongIds);
    if (success) {
      // Re-fetch to sync UI
      const updatedSongs = await api.main.playlists.getSongs(
        currentPlaylist.id
      );
      setSongs(updatedSongs);

      // If currently playing this playlist in sequential mode, update queue
      if (
        queueSource === 'playlist' && 
        queueSourceId === currentPlaylist.id && 
        !isShuffled
      ) {
        // Calculate new index for currently playing song
        let newIndex = currentIndex;
        
        // If moved the currently playing song, adjust index
        if (currentIndex === index) {
          newIndex = index + 1;
        } 
        // If moved a song from below the current song to above it
        else if (currentIndex === index + 1) {
          newIndex = index;
        }
        
        // Update the queue with the new order and adjusted index
        setQueue(updatedSongs, newIndex);
      }

      toast({
        title: I18n.playlists.detail.moveSong.successTitle,
      });
    } else {
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
        title: I18n.playlists.detail.removeSong.successTitle.replace('{0}', songTitle),
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
        <p className="text-muted-foreground">播放列表不存在</p>
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
              {songs.length} 首歌曲
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
              播放全部
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
                  <h3 className="font-semibold mb-1">播放列表为空</h3>
                  <p className="text-sm text-muted-foreground">
                    从音乐库添加歌曲到此播放列表
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate("/libraries")}
                >
                  浏览音乐库
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {songs.map((song, index) => {
                // Check if this song is currently playing from this playlist
                const isCurrentlyPlaying =
                  currentSong?.id === song.id &&
                  queueSource === "playlist" &&
                  queueSourceId === id;

                return (
                  <Card
                    key={song.id}
                    className={cn(
                      "overflow-hidden transition-colors",
                      isCurrentlyPlaying
                        ? "bg-primary/10 border-primary/50 hover:bg-primary/15"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <div className="flex items-center gap-3 p-3">
                      {/* Album Cover */}
                      <button
                        onClick={() => handlePlaySong(index)}
                        className="relative shrink-0 w-12 h-12 rounded bg-muted overflow-hidden group"
                      >
                        {song.coverUrl ? (
                          <img
                            src={song.coverUrl}
                            alt={song.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full">
                            <Music className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity",
                            isCurrentlyPlaying
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100"
                          )}
                        >
                          <Play
                            className={cn(
                              "h-5 w-5",
                              isCurrentlyPlaying ? "text-primary" : "text-white"
                            )}
                          />
                        </div>
                      </button>

                      {/* Song Info */}
                      <button
                        onClick={() => handlePlaySong(index)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p
                          className={cn(
                            "font-medium truncate",
                            isCurrentlyPlaying && "text-primary"
                          )}
                        >
                          {song.title}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {song.artist}
                          {song.album && ` • ${song.album}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDuration(song.duration || 0)}
                        </p>
                      </button>

                      {/* Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="h-8 w-8"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === songs.length - 1}
                          className="h-8 w-8"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(song.id, song.title)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
