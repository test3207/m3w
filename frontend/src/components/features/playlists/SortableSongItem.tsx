/**
 * SortableSongItem
 * A draggable song item for playlist reordering
 * 
 * Mobile: Long-press (250ms) to start dragging
 * Desktop: Drag handle visible on hover
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Music, Play, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Song } from '@m3w/shared';
import { I18n } from '@/locales/i18n';

interface SortableSongItemProps {
  song: Song;
  index: number;
  isCurrentlyPlaying: boolean;
  onPlay: (index: number) => void;
  onRemove: (songId: string, songTitle: string) => void;
  formatDuration: (seconds: number) => string;
}

export function SortableSongItem({
  song,
  index,
  isCurrentlyPlaying,
  onPlay,
  onRemove,
  formatDuration,
}: SortableSongItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'group overflow-hidden transition-colors touch-none',
        isDragging && 'opacity-90 shadow-lg scale-[1.02] z-50 ring-2 ring-primary',
        isCurrentlyPlaying
          ? 'bg-primary/10 border-primary/50 hover:bg-primary/15'
          : 'hover:bg-accent/50'
      )}
    >
      <div className="flex items-center gap-2 p-3">
        {/* Drag Handle - Desktop: visible on hover, Mobile: touch target */}
        <button
          {...attributes}
          {...listeners}
          className={cn(
            'shrink-0 p-1 rounded cursor-grab active:cursor-grabbing',
            'text-muted-foreground hover:text-foreground hover:bg-accent',
            'touch-none select-none',
            // On mobile, always visible; on desktop, show on hover
            'opacity-50 md:opacity-0 md:group-hover:opacity-100 transition-opacity',
            isDragging && 'opacity-100 cursor-grabbing'
          )}
          aria-label={I18n.playlists.detail.dragToReorder}
        >
          <GripVertical className="h-5 w-5" />
        </button>

        {/* Album Cover */}
        <button
          onClick={() => onPlay(index)}
          className="relative shrink-0 w-12 h-12 rounded bg-muted overflow-hidden group/cover"
        >
          {song.coverUrl ? (
            <img
              src={song.coverUrl}
              alt={song.title}
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <Music className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity',
              isCurrentlyPlaying
                ? 'opacity-100'
                : 'opacity-0 group-hover/cover:opacity-100'
            )}
          >
            <Play
              className={cn(
                'h-5 w-5',
                isCurrentlyPlaying ? 'text-primary' : 'text-white'
              )}
            />
          </div>
        </button>

        {/* Song Info */}
        <button
          onClick={() => onPlay(index)}
          className="flex-1 min-w-0 text-left"
        >
          <p
            className={cn(
              'font-medium truncate',
              isCurrentlyPlaying && 'text-primary'
            )}
          >
            {song.title}
          </p>
          <p className="text-sm text-muted-foreground truncate">
            {song.artist}
            {song.album && ` • ${song.album}`}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {formatDuration(song.duration || 0)}
            {song.libraryName && (
              <>
                {' • '}
                {I18n.playlists.detail.fromLibrary.replace(
                  '{0}',
                  song.libraryName
                )}
              </>
            )}
          </p>
        </button>

        {/* Remove Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(song.id, song.title)}
          className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
