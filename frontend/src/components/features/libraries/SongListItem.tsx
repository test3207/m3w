/**
 * Song List Item Component
 * Displays a single song with actions, selection mode, and cache status
 */

import { Button } from "@/components/ui/button";
import { Check, MoreVertical, Trash2, ListMusic } from "lucide-react";
import { I18n } from "@/locales/i18n";
import { CoverImage, CoverType, CoverSize } from "@/components/ui/cover-image";
import { CacheStatusIcon } from "@/components/features/songs/CacheStatusIcon";
import { formatDuration } from "@/lib/utils/format-duration";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLongPress } from "@/hooks/use-long-press";
import { useCallback } from "react";
import type { Song } from "@m3w/shared";

// Long press configuration (matches iOS/Android native behavior)
const LONG_PRESS_DELAY = 500; // ms

interface SongListItemProps {
  song: Song;
  index: number;
  isSelectionMode: boolean;
  isSelected: boolean;
  isCached: boolean;
  showCacheStatus: boolean;
  shouldDim: boolean;
  canWrite: boolean;
  onLongPress: (song: Song) => void;
  onClick: (song: Song, index: number) => void;
  onAddToPlaylist: (song: Song) => void;
  onDelete: (song: Song) => void;
}

export function SongListItem({
  song,
  index,
  isSelectionMode,
  isSelected,
  isCached,
  showCacheStatus,
  shouldDim,
  canWrite,
  onLongPress,
  onClick,
  onAddToPlaylist,
  onDelete,
}: SongListItemProps) {
  // Use @use-gesture/react for reliable long press detection
  const { bind, handleClick } = useLongPress({
    onLongPress: () => onLongPress(song),
    onClick: () => onClick(song, index),
    delay: LONG_PRESS_DELAY,
    disabled: isSelectionMode,
  });

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Shift+Enter/Space triggers selection mode (long-press equivalent)
    if ((e.key === "Enter" || e.key === " ") && e.shiftKey) {
      e.preventDefault();
      if (!isSelectionMode) {
        onLongPress(song);
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(song, index);
    }
  }, [isSelectionMode, onLongPress, onClick, song, index]);

  return (
    <div
      {...bind()}
      role="button"
      tabIndex={0}
      aria-label={song.title}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors touch-manipulation",
        isSelectionMode && isSelected && "border-primary bg-primary/5",
        isSelectionMode && "cursor-pointer",
        shouldDim && "opacity-50"
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
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
      <CoverImage
        src={song.coverUrl}
        alt={song.title}
        type={CoverType.Song}
        size={CoverSize.MD}
        className="shrink-0"
      />

      {/* Song Info */}
      <div className="flex-1 overflow-hidden">
        <p className="truncate font-medium">{song.title}</p>
        <p className="truncate text-sm text-muted-foreground">
          {song.artist}
          {song.album && ` • ${song.album}`}
        </p>
      </div>

      {/* Duration and Cache Status */}
      {!isSelectionMode && (
        <div className="flex items-center gap-2 shrink-0">
          {showCacheStatus && <CacheStatusIcon isCached={isCached} />}
          {song.duration && (
            <span className="text-sm text-muted-foreground">
              {formatDuration(song.duration)}
            </span>
          )}
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
                onAddToPlaylist(song);
              }}
            >
              <ListMusic className="mr-2 h-4 w-4" />
              {I18n.library.addToPlaylist.label}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete(song);
              }}
              className="text-destructive focus:text-destructive"
              disabled={!canWrite}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {I18n.libraries.detail.deleteSong.button}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
