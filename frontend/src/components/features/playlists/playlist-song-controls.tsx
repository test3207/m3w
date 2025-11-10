"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { I18n } from '@/locales/i18n';
import { toast } from "@/components/ui/use-toast";
import { logger } from "@/lib/logger-client";
import { apiClient, ApiError } from "@/lib/api/client";

interface PlaylistSongControlsProps {
  playlistId: string;
  songId: string;
  songTitle: string;
  index: number;
  total: number;
  onMutate?: () => void;
}

function PlaylistSongControls({ playlistId, songId, songTitle, index, total, onMutate }: PlaylistSongControlsProps) {
  const [isPending, setIsPending] = React.useState(false);

  const handleMove = async (direction: "up" | "down") => {
    setIsPending(true);
    
    try {
      await apiClient.post<{ success: boolean; message: string }>(
        `/playlists/${playlistId}/songs/reorder`,
        { songId, direction }
      );

      toast({
        title: I18n.playlist.controls.toastMoveSuccessTitle,
        description:
          direction === "up"
            ? `${I18n.playlist.controls.toastMoveUpDescriptionPrefix}${songTitle}`
            : `${I18n.playlist.controls.toastMoveDownDescriptionPrefix}${songTitle}`,
      });
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
      await apiClient.delete<{ success: boolean; message: string }>(
        `/playlists/${playlistId}/songs/${songId}`
      );

      toast({
        title: I18n.playlist.controls.toastRemoveSuccessTitle,
        description: `${I18n.playlist.controls.toastRemoveSuccessDescriptionPrefix}${songTitle}`,
      });
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
