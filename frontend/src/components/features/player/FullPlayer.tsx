/**
 * Full Player Component
 * Full-screen music player overlay
 */

import { usePlayerStore } from '@/stores/playerStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  Heart,
  ListMusic,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
} from 'lucide-react';

// Utility function for duration formatting
function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) {
    return '0:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function FullPlayer() {
  const isOpen = useUIStore((state) => state.isFullPlayerOpen);
  const closeFullPlayer = useUIStore((state) => state.closeFullPlayer);
  const openPlayQueueDrawer = useUIStore((state) => state.openPlayQueueDrawer);

  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const isShuffled = usePlayerStore((state) => state.isShuffled);
  const repeatMode = usePlayerStore((state) => state.repeatMode);
  const queueSourceName = usePlayerStore((state) => state.queueSourceName);

  const togglePlayPause = usePlayerStore((state) => state.togglePlayPause);
  const previous = usePlayerStore((state) => state.previous);
  const next = usePlayerStore((state) => state.next);
  const seek = usePlayerStore((state) => state.seek);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const toggleRepeat = usePlayerStore((state) => state.toggleRepeat);

  if (!isOpen || !currentSong) {
    return null;
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    seek(newTime);
  };

  const handleClose = () => {
    closeFullPlayer();
  };

  const handleOpenQueue = () => {
    openPlayQueueDrawer();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <Button variant="ghost" size="icon" onClick={handleClose}>
          <ChevronDown className="h-6 w-6" />
        </Button>
        <div className="text-sm text-muted-foreground">
          {queueSourceName || '播放队列'}
        </div>
        <Button variant="ghost" size="icon" onClick={handleOpenQueue}>
          <ListMusic className="h-5 w-5" />
        </Button>
      </div>

      {/* Album Cover */}
      <div className="flex justify-center px-8 py-8">
        <div className="aspect-square w-full max-w-sm overflow-hidden rounded-lg shadow-2xl">
          {currentSong.coverUrl ? (
            <img
              src={currentSong.coverUrl}
              alt={currentSong.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <span className="text-4xl text-muted-foreground">♪</span>
            </div>
          )}
        </div>
      </div>

      {/* Song Info */}
      <div className="px-8 py-4 text-center">
        <h1 className="text-2xl font-bold truncate">{currentSong.title}</h1>
        <p className="text-lg text-muted-foreground truncate mt-2">
          {currentSong.artist}
        </p>
        {currentSong.album && (
          <p className="text-sm text-muted-foreground truncate mt-1">
            {currentSong.album}
          </p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="px-8 py-4">
        <div
          className="h-1 w-full cursor-pointer rounded-full bg-secondary"
          onClick={handleProgressClick}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="px-8 py-6">
        {/* Secondary Controls */}
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleShuffle}
            className={isShuffled ? 'text-primary' : ''}
          >
            <Shuffle className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Heart className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleRepeat}
            className={repeatMode !== 'off' ? 'text-primary' : ''}
          >
            <Repeat className="h-5 w-5" />
            {repeatMode === 'one' && (
              <span className="absolute text-xs font-bold">1</span>
            )}
          </Button>
        </div>

        {/* Primary Controls */}
        <div className="flex items-center justify-center gap-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={previous}
            className="h-12 w-12"
          >
            <SkipBack className="h-8 w-8" />
          </Button>

          <Button
            variant="default"
            size="icon"
            onClick={togglePlayPause}
            className="h-16 w-16 rounded-full"
          >
            {isPlaying ? (
              <Pause className="h-8 w-8" />
            ) : (
              <Play className="h-8 w-8 translate-x-0.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={next}
            className="h-12 w-12"
          >
            <SkipForward className="h-8 w-8" />
          </Button>
        </div>
      </div>
    </div>
  );
}
