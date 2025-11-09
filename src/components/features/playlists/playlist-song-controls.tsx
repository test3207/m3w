"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { PLAYLIST_TEXT } from "@/locales/messages";
import { toast } from "@/components/ui/use-toast";
import { logger } from "@/lib/logger-client";

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
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move', songId, direction }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast({
          title: PLAYLIST_TEXT.controls.toastMoveSuccessTitle,
          description:
            direction === "up"
              ? `${PLAYLIST_TEXT.controls.toastMoveUpDescriptionPrefix}${songTitle}`
              : `${PLAYLIST_TEXT.controls.toastMoveDownDescriptionPrefix}${songTitle}`,
        });
        onMutate?.();
      } else if (data.error?.includes('Invalid direction')) {
        // Silent fail for edge cases
      } else {
        toast({
          variant: "destructive",
          title: PLAYLIST_TEXT.controls.toastActionErrorTitle,
          description: PLAYLIST_TEXT.controls.toastActionErrorDescription,
        });
      }
    } catch (error) {
      logger.error('Failed to move song', error);
      toast({
        variant: "destructive",
        title: PLAYLIST_TEXT.controls.toastActionErrorTitle,
        description: PLAYLIST_TEXT.controls.toastActionErrorDescription,
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleRemove = async () => {
    setIsPending(true);

    try {
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', songId }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast({
          title: PLAYLIST_TEXT.controls.toastRemoveSuccessTitle,
          description: `${PLAYLIST_TEXT.controls.toastRemoveSuccessDescriptionPrefix}${songTitle}`,
        });
        onMutate?.();
      } else {
        toast({
          variant: "destructive",
          title: PLAYLIST_TEXT.controls.toastActionErrorTitle,
          description: PLAYLIST_TEXT.controls.toastActionErrorDescription,
        });
      }
    } catch (error) {
      logger.error('Failed to remove song', error);
      toast({
        variant: "destructive",
        title: PLAYLIST_TEXT.controls.toastActionErrorTitle,
        description: PLAYLIST_TEXT.controls.toastActionErrorDescription,
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
        aria-label={PLAYLIST_TEXT.controls.moveUp}
        onClick={() => handleMove("up")}
        disabled={isPending || index === 0}
      >
        ↑
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={PLAYLIST_TEXT.controls.moveDown}
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
        {PLAYLIST_TEXT.controls.removeButton}
      </Button>
    </div>
  );
}

export { PlaylistSongControls };
