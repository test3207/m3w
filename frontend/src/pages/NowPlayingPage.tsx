/**
 * Now Playing Page
 * Main page showing current playback with queue
 */

import { usePlayerStore } from '@/stores/playerStore';
import { useUIStore } from '@/stores/uiStore';
import { Play, List } from 'lucide-react';

export default function NowPlayingPage() {
  const currentSong = usePlayerStore((state) => state.currentSong);
  const queueSourceName = usePlayerStore((state) => state.queueSourceName);
  const openFullPlayer = useUIStore((state) => state.openFullPlayer);
  const openPlayQueueDrawer = useUIStore((state) => state.openPlayQueueDrawer);

  if (!currentSong) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center">
          <Play className="mx-auto h-16 w-16 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-semibold">没有正在播放的歌曲</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            从音乐库或播放列表选择歌曲开始播放
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex-1">
        <h1 className="text-2xl font-bold mb-4">正在播放</h1>

        {/* Current Song Card */}
        <div
          className="rounded-lg border bg-card p-6 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={openFullPlayer}
        >
          <div className="flex items-center gap-4">
            {/* Album Cover */}
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
              {currentSong.coverUrl ? (
                <img
                  src={currentSong.coverUrl}
                  alt={currentSong.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                  No Cover
                </div>
              )}
            </div>

            {/* Song Info */}
            <div className="flex-1 overflow-hidden">
              <p className="font-semibold text-lg truncate">{currentSong.title}</p>
              <p className="text-sm text-muted-foreground truncate">{currentSong.artist}</p>
              {currentSong.album && (
                <p className="text-xs text-muted-foreground truncate mt-1">{currentSong.album}</p>
              )}
            </div>
          </div>

          {/* Queue Source */}
          {queueSourceName && (
            <div className="mt-4 text-sm text-muted-foreground">
              当前播放自：{queueSourceName}
            </div>
          )}
        </div>

        {/* View Queue Button */}
        <button
          onClick={openPlayQueueDrawer}
          className="mt-4 w-full rounded-lg border bg-card p-4 flex items-center justify-center gap-2 hover:bg-accent transition-colors"
        >
          <List className="h-5 w-5" />
          <span>查看播放队列</span>
        </button>
      </div>
    </div>
  );
}
