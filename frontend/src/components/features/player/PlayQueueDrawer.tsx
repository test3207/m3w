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

export function PlayQueueDrawer() {
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
      title: '已从队列移除',
    });
  };

  const handleClearQueue = () => {
    clearQueue();
    closePlayQueueDrawer();
    toast({
      title: '队列已清空',
    });
  };

  const handleSaveAsPlaylist = async () => {
    if (!playlistName.trim()) {
      toast({
        variant: 'destructive',
        title: '请输入播放列表名称',
      });
      return;
    }

    setIsSaving(true);
    try {
      const success = await saveQueueAsPlaylist(playlistName);
      if (success) {
        toast({
          title: '保存成功',
          description: `播放列表"${playlistName}"已创建`,
        });
        setPlaylistName('');
        setShowSaveInput(false);
      } else {
        toast({
          variant: 'destructive',
          title: '保存失败',
          description: '无法保存播放列表',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '保存失败',
        description: error instanceof Error ? error.message : '未知错误',
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
            播放队列 ({queue.length} 首)
          </SheetTitle>
          {queueSourceName && (
            <SheetDescription>
              当前播放自：{queueSourceName}
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
                保存为播放列表
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearQueue}
                disabled={queue.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                清空队列
              </Button>
            </>
          ) : (
            <div className="flex w-full gap-2">
              <Input
                placeholder="输入播放列表名称"
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
                {isSaving ? '保存中...' : '保存'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowSaveInput(false);
                  setPlaylistName('');
                }}
              >
                取消
              </Button>
            </div>
          )}
        </div>

        {queue.length === 0 ? (
          <div className="mt-8 text-center text-muted-foreground">
            <p>队列为空</p>
            <p className="mt-2 text-sm">从音乐库或播放列表选择歌曲</p>
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
                      <span className="ml-2 text-xs text-primary">● 正在播放</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {song.artist}
                  </p>
                </div>

                {/* Duration */}
                {song.file?.duration && (
                  <div className="shrink-0 text-sm text-muted-foreground">
                    {formatDuration(song.file.duration)}
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
