/**
 * Play Queue Drawer Component
 * Displays and manages the current playback queue
 */

import { usePlayerStore } from '@/stores/playerStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { X, Trash2, GripVertical, Save } from 'lucide-react';
import { formatDuration } from '@/lib/utils/format';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';

export function PlayQueueDrawer() {
  useLocale();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const isOpen = useUIStore((state) => state.isPlayQueueDrawerOpen);
  const closePlayQueueDrawer = useUIStore((state) => state.closePlayQueueDrawer);

  const queue = usePlayerStore((state) => state.queue);
  const currentIndex = usePlayerStore((state) => state.currentIndex);
  const queueSourceName = usePlayerStore((state) => state.queueSourceName);
  const seekTo = usePlayerStore((state) => state.seekTo);
  const removeFromQueue = usePlayerStore((state) => state.removeFromQueue);
  const clearQueue = usePlayerStore((state) => state.clearQueue);
  const saveQueueAsPlaylist = usePlayerStore((state) => state.saveQueueAsPlaylist);

  const handleSongClick = (index: number) => {
    seekTo(index);
  };

  const handleRemoveSong = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFromQueue(index);
    toast({
      title: I18n.player.playQueue.removeFromQueueTitle,
    });
  };

  const handleClearQueue = () => {
    clearQueue();
    closePlayQueueDrawer();
    toast({
      title: I18n.player.playQueue.clearQueueTitle,
    });
  };

  const handleSaveAsPlaylist = async () => {
    if (!playlistName.trim()) {
      toast({
        variant: 'destructive',
        title: I18n.player.playQueue.savePlaylistErrorEmptyName,
      });
      return;
    }

    setIsSaving(true);
    try {
      const success = await saveQueueAsPlaylist(playlistName);
      if (success) {
        toast({
          title: I18n.player.playQueue.savePlaylistSuccessTitle,
          description: I18n.player.playQueue.savePlaylistSuccessDescription.replace('{0}', playlistName),
        });
        setPlaylistName('');
        setShowSaveInput(false);
      } else {
        toast({
          variant: 'destructive',
          title: I18n.player.playQueue.savePlaylistErrorTitle,
          description: I18n.player.playQueue.savePlaylistErrorDescription,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: I18n.player.playQueue.savePlaylistErrorTitle,
        description: error instanceof Error ? error.message : I18n.player.playQueue.savePlaylistErrorUnknown,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={closePlayQueueDrawer}>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>
            {I18n.player.playQueue.title} ({I18n.player.playQueue.songsCount.replace('{0}', String(queue.length))})
          </SheetTitle>
          {queueSourceName && (
            <SheetDescription>
              {I18n.player.playQueue.playingFrom.replace('{0}', queueSourceName)}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-4 flex gap-2">
          {!showSaveInput ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaveInput(true)}
                disabled={queue.length === 0}
              >
                <Save className="mr-2 h-4 w-4" />
                {I18n.player.playQueue.saveAsPlaylistButton}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearQueue}
                disabled={queue.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {I18n.player.playQueue.clearQueueButton}
              </Button>
            </>
          ) : (
            <div className="flex w-full gap-2">
              <Input
                placeholder={I18n.player.playQueue.savePlaylistInputPlaceholder}
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveAsPlaylist();
                  } else if (e.key === 'Escape') {
                    setShowSaveInput(false);
                    setPlaylistName('');
                  }
                }}
              />
              <Button
                size="sm"
                onClick={handleSaveAsPlaylist}
                disabled={isSaving || !playlistName.trim()}
              >
                {isSaving ? I18n.player.playQueue.savingButton : I18n.player.playQueue.saveButton}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowSaveInput(false);
                  setPlaylistName('');
                }}
              >
                {I18n.common.cancelButton}
              </Button>
            </div>
          )}
        </div>

        {queue.length === 0 ? (
          <div className="mt-8 text-center text-muted-foreground">
            <p>{I18n.player.playQueue.emptyTitle}</p>
            <p className="mt-2 text-sm">{I18n.player.playQueue.emptyDescription}</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2 overflow-y-auto pb-20">
            {queue.map((song, index) => (
              <div
                key={`${song.id}-${index}`}
                onClick={() => handleSongClick(index)}
                className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-accent ${
                  index === currentIndex ? 'bg-accent border-primary' : ''
                }`}
              >
                {/* Drag Handle */}
                <div className="shrink-0 cursor-grab text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                </div>

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
                  <p className="truncate font-medium">
                    {song.title}
                    {index === currentIndex && (
                      <span className="ml-2 text-xs text-primary">● {I18n.player.playQueue.nowPlaying}</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {song.artist}
                  </p>
                </div>

                {/* Duration */}
                {song.duration && (
                  <div className="shrink-0 text-sm text-muted-foreground">
                    {formatDuration(song.duration)}
                  </div>
                )}

                {/* Remove Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleRemoveSong(index, e)}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
