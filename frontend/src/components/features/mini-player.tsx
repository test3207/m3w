'use client';

/**
 * Mini Player Bar
 * 
 * Fixed bottom player bar with playback controls
 */

import { useEffect, useRef } from 'react';
import { useAudioPlayer } from '@/lib/audio/useAudioPlayer';
import { Button } from '@/components/ui/button';
import { HStack, VStack } from '@/components/ui/stack';
import { Repeat, Repeat1, Shuffle } from 'lucide-react';
import { RepeatMode } from '@/lib/audio/queue';
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function MiniPlayer() {
  useLocale(); // Subscribe to locale changes
  
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playContext,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    queueState,
    cycleRepeat,
    toggleShuffle,
  } = useAudioPlayer();
  const { shuffleEnabled, repeatMode } = queueState;
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const element = containerRef.current;

    const dispatchHeight = (height: number) => {
      root.style.setProperty('--mini-player-height', `${height}px`);
      window.dispatchEvent(
        new CustomEvent('dashboard:mini-player-height', {
          detail: { height },
        })
      );
    };

    if (!currentTrack) {
      dispatchHeight(0);
      return;
    }

    if (!element) {
      dispatchHeight(0);
      return;
    }

    const updateHeight = () => {
      dispatchHeight(element.offsetHeight);
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
      dispatchHeight(0);
    };
  }, [currentTrack]);

  if (!currentTrack) {
    return null; // Hide player when no track
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const repeatLabels: Record<RepeatMode, string> = {
    [RepeatMode.OFF]: I18n.player.repeat.off,
    [RepeatMode.ALL]: I18n.player.repeat.all,
    [RepeatMode.ONE]: I18n.player.repeat.one,
  };
  const repeatLabel = repeatLabels[repeatMode];
  const shuffleLabel = shuffleEnabled ? I18n.player.shuffle.disable : I18n.player.shuffle.enable;
  const repeatStateText: Record<RepeatMode, string> = {
    [RepeatMode.OFF]: I18n.player.state.repeatOff,
    [RepeatMode.ALL]: I18n.player.state.repeatQueue,
    [RepeatMode.ONE]: I18n.player.state.repeatTrack,
  };
  const shuffleStateText = shuffleEnabled ? I18n.player.state.shuffleOn : I18n.player.state.shuffleOff;

  const renderRepeatIcon = () => {
    if (repeatMode === RepeatMode.ONE) {
      return <Repeat1 className="w-5 h-5" />;
    }
    return <Repeat className="w-5 h-5" />;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    seek(newTime);
  };

  return (
    <div
      ref={containerRef}
      className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50"
      role="region"
      aria-label={I18n.player.ariaLabel}
    >
      {/* Progress Bar */}
      <div
        className="h-1 bg-muted cursor-pointer hover:h-2 transition-all"
        onClick={handleSeek}
        role="slider"
        aria-label={I18n.player.seekLabel}
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
      >
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Player Controls */}
      <div className="px-4 py-3">
        <HStack justify="between" align="center" gap="md">
          {/* Track Info */}
          <HStack gap="sm" align="center" className="flex-1 min-w-0">
            {currentTrack.coverUrl && (
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                width={48}
                height={48}
                className="rounded object-cover"
              />
            )}
            <VStack gap="none" className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {currentTrack.title}
              </p>
              {currentTrack.artist && (
                <p className="text-xs text-muted-foreground truncate">
                  {currentTrack.artist}
                </p>
              )}
              {playContext && (
                <p className="text-xs text-muted-foreground truncate">
                  {playContext.type === 'playlist' && '📻 '}
                  {playContext.type === 'library' && '🎵 '}
                  {playContext.name}
                </p>
              )}
            </VStack>
          </HStack>

          {/* Playback Controls */}
          <HStack gap="sm" align="center" className="shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={previous}
              aria-label={I18n.player.previousTrack}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Button>

            <Button
              variant="default"
              size="icon"
              onClick={togglePlay}
              aria-label={isPlaying ? I18n.player.pause : I18n.player.play}
            >
              {isPlaying ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 9v6m4-6v6"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                </svg>
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={next}
              aria-label={I18n.player.nextTrack}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Button>

            <Button
              variant={shuffleEnabled ? 'secondary' : 'ghost'}
              size="icon"
              onClick={toggleShuffle}
              aria-label={shuffleLabel}
              aria-pressed={shuffleEnabled}
            >
              <Shuffle className="w-5 h-5" />
            </Button>

            <Button
              variant={repeatMode === RepeatMode.OFF ? 'ghost' : 'secondary'}
              size="icon"
              onClick={cycleRepeat}
              aria-label={repeatLabel}
              aria-pressed={repeatMode !== RepeatMode.OFF}
            >
              {renderRepeatIcon()}
            </Button>
          </HStack>

          <VStack gap="none" className="items-end text-[11px] text-muted-foreground leading-tight">
            <span>{shuffleStateText}</span>
            <span>{repeatStateText[repeatMode]}</span>
          </VStack>

          {/* Time & Volume */}
          <HStack gap="sm" align="center" className="shrink-0">
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              aria-label={isMuted ? I18n.player.unmute : I18n.player.mute}
            >
              {isMuted || volume === 0 ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                </svg>
              )}
            </Button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 h-1"
              aria-label={I18n.player.volume}
            />
          </HStack>
        </HStack>
      </div>
    </div>
  );
}
