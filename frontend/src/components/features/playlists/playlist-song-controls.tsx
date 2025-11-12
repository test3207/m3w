"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { I18n } from '@/locales/i18n';
import { toast } from "@/components/ui/use-toast";
import { logger } from "@/lib/logger-client";
import { api } from "@/services";
import { ApiError } from "@/lib/api/client";
import { PLAYLISTS_QUERY_KEY } from "@/hooks/usePlaylists";

interface PlaylistSongControlsProps {
  playlistId: string;
  songId: string;
  songTitle: string;
  index: number;
  total: number;
  onMutate?: () => void;
  onPlaylistUpdated?: (playlistId: string) => void | Promise<void>;
}

function PlaylistSongControls({ playlistId, songId, songTitle, index, total, onMutate, onPlaylistUpdated }: PlaylistSongControlsProps) {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = React.useState(false);

  const handleMove = async (direction: "up" | "down") => {
    setIsPending(true);
    
    try {
      await api.main.playlists.reorderSong(playlistId, { songId, direction });

      toast({
        title: I18n.playlist.controls.toastMoveSuccessTitle,
        description:
          direction === "up"
            ? `${I18n.playlist.controls.toastMoveUpDescriptionPrefix}${songTitle}`
            : `${I18n.playlist.controls.toastMoveDownDescriptionPrefix}${songTitle}`,
      });
      
      // Invalidate playlists query to update song count on dashboard
      queryClient.invalidateQueries({ queryKey: PLAYLISTS_QUERY_KEY });
      
      // 通知播放列表已更新
      if (onPlaylistUpdated) {
        await onPlaylistUpdated(playlistId);
      }
      
      onMutate?.();
    } catch (error) {
      logger.error('Failed to move song', error);
      toast({
        variant: "destructive",
        title: I18n.playlist.controls.toastActionErrorTitle,
        description: error instanceof ApiError ? error.message : I18n.playlist.controls.toastActionErrorDescription,
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleRemove = async () => {
    setIsPending(true);

    try {
      await api.main.playlists.removeSong(playlistId, songId);

      toast({
        title: I18n.playlist.controls.toastRemoveSuccessTitle,
        description: `${I18n.playlist.controls.toastRemoveSuccessDescriptionPrefix}${songTitle}`,
      });
      
      // Invalidate playlists query to update song count on dashboard
      queryClient.invalidateQueries({ queryKey: PLAYLISTS_QUERY_KEY });
      
      // 通知播放列表已更新
      if (onPlaylistUpdated) {
        await onPlaylistUpdated(playlistId);
      }
      
      onMutate?.();
    } catch (error) {
      logger.error('Failed to remove song', error);
      toast({
        variant: "destructive",
        title: I18n.playlist.controls.toastActionErrorTitle,
        description: error instanceof ApiError ? error.message : I18n.playlist.controls.toastActionErrorDescription,
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={I18n.playlist.controls.moveUp}
        onClick={() => handleMove("up")}
        disabled={isPending || index === 0}
      >
        ↑
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={I18n.playlist.controls.moveDown}
        onClick={() => handleMove("down")}
        disabled={isPending || index === total - 1}
      >
        ↓
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={handleRemove}
        disabled={isPending}
      >
        {I18n.playlist.controls.removeButton}
      </Button>
    </div>
  );
}

export { PlaylistSongControls };
