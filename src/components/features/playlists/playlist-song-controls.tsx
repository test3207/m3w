"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { PLAYLIST_TEXT } from "@/locales/messages";
import { toast } from "@/components/ui/use-toast";
import { moveSongAction, removeSongAction, type MoveSongInput } from "@/app/(dashboard)/dashboard/playlists/[id]/actions";

interface PlaylistSongControlsProps {
  playlistId: string;
  songId: string;
  songTitle: string;
  index: number;
  total: number;
}

function PlaylistSongControls({ playlistId, songId, songTitle, index, total }: PlaylistSongControlsProps) {
  const [isPending, startTransition] = React.useTransition();

  const handleMove = (direction: MoveSongInput["direction"]) => {
    startTransition(async () => {
      const result = await moveSongAction({ playlistId, songId, direction });

      if (result.status === "success") {
        toast({
          title: PLAYLIST_TEXT.controls.toastMoveSuccessTitle,
          description:
            direction === "up"
              ? `${PLAYLIST_TEXT.controls.toastMoveUpDescriptionPrefix}${songTitle}`
              : `${PLAYLIST_TEXT.controls.toastMoveDownDescriptionPrefix}${songTitle}`,
        });
        return;
      }

      if (result.message === "invalid-direction") {
        return;
      }

      toast({
        variant: "destructive",
        title: PLAYLIST_TEXT.controls.toastActionErrorTitle,
        description: PLAYLIST_TEXT.controls.toastActionErrorDescription,
      });
    });
  };

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeSongAction({ playlistId, songId });

      if (result.status === "success") {
        toast({
          title: PLAYLIST_TEXT.controls.toastRemoveSuccessTitle,
          description: `${PLAYLIST_TEXT.controls.toastRemoveSuccessDescriptionPrefix}${songTitle}`,
        });
        return;
      }

      toast({
        variant: "destructive",
        title: PLAYLIST_TEXT.controls.toastActionErrorTitle,
        description: PLAYLIST_TEXT.controls.toastActionErrorDescription,
      });
    });
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
