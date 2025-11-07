"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { UI_TEXT } from "@/locales/messages";
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
          title: UI_TEXT.playlistBuilder.toastMoveSuccessTitle,
          description:
            direction === "up"
              ? `${UI_TEXT.playlistBuilder.toastMoveUpDescriptionPrefix}${songTitle}`
              : `${UI_TEXT.playlistBuilder.toastMoveDownDescriptionPrefix}${songTitle}`,
        });
        return;
      }

      if (result.message === "invalid-direction") {
        return;
      }

      toast({
        variant: "destructive",
        title: UI_TEXT.playlistBuilder.toastActionErrorTitle,
        description: UI_TEXT.playlistBuilder.toastActionErrorDescription,
      });
    });
  };

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeSongAction({ playlistId, songId });

      if (result.status === "success") {
        toast({
          title: UI_TEXT.playlistBuilder.toastRemoveSuccessTitle,
          description: `${UI_TEXT.playlistBuilder.toastRemoveSuccessDescriptionPrefix}${songTitle}`,
        });
        return;
      }

      toast({
        variant: "destructive",
        title: UI_TEXT.playlistBuilder.toastActionErrorTitle,
        description: UI_TEXT.playlistBuilder.toastActionErrorDescription,
      });
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={UI_TEXT.playlistBuilder.moveUp}
        onClick={() => handleMove("up")}
        disabled={isPending || index === 0}
      >
        ↑
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={UI_TEXT.playlistBuilder.moveDown}
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
        {UI_TEXT.playlistBuilder.removeButton}
      </Button>
    </div>
  );
}

export { PlaylistSongControls };
