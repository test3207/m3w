/**
 * Full Player Component
 *
 * A full-screen music player overlay with gesture support, animations, and
 * mobile back button integration.
 *
 * ## UI Structure
 * ```
 * ┌─────────────────────────────┐
 * │ [↓]    Queue Source    [≡] │  Header: back button, source name, queue button
 * ├─────────────────────────────┤
 * │                             │
 * │      ┌─────────────┐       │
 * │      │   Album     │       │  Album Cover: square, rounded, shadow
 * │      │   Cover     │       │
 * │      └─────────────┘       │
 * │                             │
 * │      Song Title             │  Song Info: title, artist, album
 * │      Artist Name            │
 * │                             │
 * ├─────────────────────────────┤
 * │ ───●──────────── 2:15/4:30 │  Progress: clickable seek bar
 * │   [⏮]   [⏯]   [⏭]         │  Primary Controls: prev, play/pause, next
 * │  🔀Shuffle  ❤️Fav  🔁Repeat │  Secondary Controls: shuffle, favorite, repeat
 * └─────────────────────────────┘
 * ```
 *
 * ## Animation State Machine
 * ```
 * Hidden ──(open)──► Entering ──(RAF×2)──► Visible ──(close)──► Exiting ──(transitionEnd)──► Hidden
 * ```
 *
 * ## Gesture Support
 * - **Swipe Down**: Close with downward exit animation
 * - **Swipe Right**: Close with rightward exit animation
 * - **Drag**: Follow finger with opacity feedback, snap back if below threshold
 *
 * ## Mobile Back Button
 * Uses History API to intercept browser back button on mobile devices.
 * Pushes a state on open, listens to popstate to close.
 *
 * @see {@link GESTURE_CONFIG} - Swipe threshold and drag resistance settings
 * @see {@link ANIMATION_CONFIG} - Animation duration and easing
 * @see {@link animationReducer} - State machine for enter/exit animations
 */

import { useMemo, useEffect, useRef, useCallback, useState, useReducer } from 'react';
import { usePlayerStore } from '@/stores/playerStore';
import { usePlaylistStore } from '@/stores/playlistStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import {
  ChevronDown,
  Heart,
  ListMusic,
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
} from 'lucide-react';
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';
import { logger } from '@/lib/logger-client';
import { Text } from '@/components/ui/text';
import { Stack } from '@/components/ui/stack';
import { RepeatMode } from '@m3w/shared';

import { GESTURE_CONFIG, ANIMATION_CONFIG, TRANSFORM } from './constants';
import {
  AnimationPhase,
  ExitDirection,
  AnimationActionType,
  animationReducer,
} from './types';

// ============================================================================
// Utilities
// ============================================================================

/** Format duration in seconds to human-readable string (e.g., "3:45" or "1:23:45") */
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

// ============================================================================
// Component
// ============================================================================

export function FullPlayer() {
  useLocale();
  
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

  // Favorites functionality - subscribe to playlistSongIds to trigger re-render when favorites change
  const playlists = usePlaylistStore((state) => state.playlists);
  const playlistSongIds = usePlaylistStore((state) => state.playlistSongIds);
  const toggleFavorite = usePlaylistStore((state) => state.toggleFavorite);
  const fetchPlaylists = usePlaylistStore((state) => state.fetchPlaylists);
  const getFavoritesPlaylist = usePlaylistStore((state) => state.getFavoritesPlaylist);

  // Touch gesture tracking
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Drag state for gesture tracking
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  // Animation state machine using reducer pattern
  // States: 'hidden' -> 'entering' -> 'visible' -> 'exiting' -> 'hidden'
  const [animationState, dispatch] = useReducer(
    animationReducer,
    { phase: isOpen ? AnimationPhase.Entering : AnimationPhase.Hidden, exitDirection: ExitDirection.Down }
  );
  const { phase: animationPhase, exitDirection } = animationState;
  
  // Handle isOpen changes - dispatch animation actions
  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;
    
    if (isOpen && !wasOpen) {
      // Opening: start enter animation
      dispatch({ type: AnimationActionType.Open });
      // Use double requestAnimationFrame to ensure 'entering' renders first
      // at translateY(100%), then transition to 'visible' at translateY(0)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          dispatch({ type: AnimationActionType.OpenComplete });
        });
      });
    } else if (!isOpen && wasOpen) {
      // Closing: start exit animation (default down for non-gesture close)
      dispatch({ type: AnimationActionType.Close, direction: ExitDirection.Down });
    }
  }, [isOpen]);
  
  // Handle transition end - cleanup after exit animation
  const handleTransitionEnd = useCallback((e: React.TransitionEvent) => {
    // Only handle transform transitions on the container itself
    if (e.propertyName === 'transform' && e.target === containerRef.current) {
      if (animationPhase === AnimationPhase.Exiting) {
        dispatch({ type: AnimationActionType.CloseComplete });
        setDragOffset({ x: 0, y: 0 });
      }
    }
  }, [animationPhase]);

  // Stable close handler for history API
  const handleClose = useCallback(() => {
    closeFullPlayer();
  }, [closeFullPlayer]);

  // Handle browser back button via History API
  useEffect(() => {
    if (!isOpen) return;

    // Push a history state when FullPlayer opens
    const historyState = { fullPlayerOpen: true };
    window.history.pushState(historyState, '');

    // Handle popstate (back button)
    const handlePopState = (event: PopStateEvent) => {
      // Check if we're navigating back from FullPlayer state
      if (!event.state?.fullPlayerOpen) {
        handleClose();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Clean up history state if component unmounts while open (e.g., button/gesture close)
      // Use replaceState instead of back() to avoid triggering another popstate event
      if (window.history.state?.fullPlayerOpen) {
        window.history.replaceState(null, '');
      }
    };
  }, [isOpen, handleClose]);

  // Touch gesture handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !isDragging) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Only allow dragging down or right (positive values)
    // Apply resistance to make it feel natural
    const offsetX = Math.max(0, deltaX * GESTURE_CONFIG.DRAG_RESISTANCE);
    const offsetY = Math.max(0, deltaY * GESTURE_CONFIG.DRAG_RESISTANCE);

    setDragOffset({ x: offsetX, y: offsetY });
  }, [isDragging]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Check for swipe down (deltaY positive) or swipe right (deltaX positive)
    const isSwipeDown = deltaY > GESTURE_CONFIG.SWIPE_THRESHOLD && Math.abs(deltaX) < deltaY;
    const isSwipeRight = deltaX > GESTURE_CONFIG.SWIPE_THRESHOLD && Math.abs(deltaY) < deltaX;

    if (isSwipeDown || isSwipeRight) {
      const direction = isSwipeRight ? ExitDirection.Right : ExitDirection.Down;
      logger.debug('[FullPlayer] Swipe gesture detected:', direction);
      // Dispatch close with direction before calling closeFullPlayer
      dispatch({ type: AnimationActionType.Close, direction });
      // Use setTimeout to ensure the direction is set before the store updates
      setTimeout(() => closeFullPlayer(), 0);
    } else {
      // Snap back with animation
      setDragOffset({ x: 0, y: 0 });
    }

    touchStartRef.current = null;
    setIsDragging(false);
  }, [closeFullPlayer]);
  
  // Ensure playlists are loaded when FullPlayer opens
  useEffect(() => {
    if (isOpen && playlists.length === 0) {
      fetchPlaylists();
    }
  }, [isOpen, playlists.length, fetchPlaylists]);
  
  // Compute isFavorited directly from playlistSongIds to ensure reactivity
  const isFavorited = useMemo(() => {
    if (!currentSong) return false;
    const favorites = getFavoritesPlaylist();
    if (!favorites) return false;
    const songIds = playlistSongIds[favorites.id] || [];
    return songIds.includes(currentSong.id);
  }, [currentSong, getFavoritesPlaylist, playlistSongIds]);

  const handleToggleFavorite = async () => {
    if (!currentSong) return;
    
    // Capture current state before toggle
    const wasFavorited = isFavorited;
    // Pass coverUrl so playlist can update its cover when first song is added
    const wasSuccess = await toggleFavorite(currentSong.id, currentSong.coverUrl);
    
    if (wasSuccess) {
      // After toggle: if was favorited, now removed; if was not favorited, now added
      toast({
        title: wasFavorited ? I18n.player.favorite.removed : I18n.player.favorite.added,
      });
    } else {
      toast({
        title: wasFavorited ? I18n.player.favorite.removeError : I18n.player.favorite.addError,
        variant: 'destructive',
      });
    }
  };

  // Debug: Log current repeatMode when next button is clicked
  const handleNext = () => {
    logger.debug('[FullPlayer] Next button clicked, current repeatMode:', repeatMode);
    next();
  };

  // Don't render if hidden (after close animation completes)
  if (animationPhase === AnimationPhase.Hidden || !currentSong) {
    return null;
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Calculate transform based on animation state and drag
  const getTransform = () => {
    if (isDragging && (dragOffset.x > 0 || dragOffset.y > 0)) {
      // During drag: follow finger
      return `translate(${dragOffset.x}px, ${dragOffset.y}px)`;
    }
    // 'entering' starts at bottom, 'visible' is at origin
    if (animationPhase === AnimationPhase.Entering) {
      return TRANSFORM.ENTER_START;
    }
    // 'exiting' goes in the direction of the swipe
    if (animationPhase === AnimationPhase.Exiting) {
      return exitDirection === ExitDirection.Right ? TRANSFORM.EXIT_RIGHT : TRANSFORM.EXIT_DOWN;
    }
    return TRANSFORM.VISIBLE;
  };

  // Determine if transition should be enabled
  const shouldAnimate = !isDragging && (animationPhase === AnimationPhase.Visible || animationPhase === AnimationPhase.Exiting);

  // Calculate opacity based on drag distance
  const getOpacity = () => {
    if (!isDragging) return 1;
    const dragDistance = Math.max(dragOffset.x, dragOffset.y);
    return Math.max(
      GESTURE_CONFIG.MIN_DRAG_OPACITY, 
      1 - dragDistance / GESTURE_CONFIG.MAX_DRAG_FOR_OPACITY
    );
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    seek(newTime);
  };

  const handleOpenQueue = () => {
    openPlayQueueDrawer();
  };

  return (
    <div 
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={I18n.player.fullPlayer.ariaLabel}
      className="fixed inset-0 z-50 bg-background flex flex-col touch-pan-y"
      style={{
        transform: getTransform(),
        opacity: getOpacity(),
        transition: shouldAnimate 
          ? `transform ${ANIMATION_CONFIG.DURATION_MS}ms ${ANIMATION_CONFIG.EASING}, opacity ${ANIMATION_CONFIG.DURATION_MS}ms ${ANIMATION_CONFIG.EASING}`
          : 'none',
        willChange: 'transform, opacity',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTransitionEnd={handleTransitionEnd}
    >
      {/* Header */}
      <Stack direction="horizontal" align="center" justify="between" className="p-4 shrink-0">
        <Button variant="ghost" size="icon" onClick={handleClose} aria-label={I18n.player.fullPlayer.close}>
          <ChevronDown className="h-6 w-6" />
        </Button>
        <Text variant="body" color="muted">
          {queueSourceName || I18n.player.playQueue.fallbackSource}
        </Text>
        <Button variant="ghost" size="icon" onClick={handleOpenQueue} aria-label={I18n.player.playQueue.open}>
          <ListMusic className="h-5 w-5" />
        </Button>
      </Stack>

      {/* Album Cover */}
      <Stack align="center" className="px-8 py-4 shrink-0">
        <div className="aspect-square w-full max-w-[280px] overflow-hidden rounded-lg shadow-2xl">
          {currentSong.coverUrl ? (
            <img
              src={currentSong.coverUrl}
              alt={`${I18n.player.fullPlayer.albumCoverAlt} - ${currentSong.title}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <Stack align="center" justify="center" className="h-full w-full bg-muted">
              <Music className="h-20 w-20 text-muted-foreground/30" aria-hidden="true" />
            </Stack>
          )}
        </div>
      </Stack>

      {/* Song Info */}
      <Stack gap="xs" align="center" className="px-8 py-4 shrink-0">
        <Text variant="h3" className="truncate w-full text-center">{currentSong.title}</Text>
        <Text variant="h5" color="muted" className="truncate w-full text-center">
          {currentSong.artist}
        </Text>
        {currentSong.album && (
          <Text variant="caption" color="muted" className="truncate w-full text-center">
            {currentSong.album}
          </Text>
        )}
      </Stack>

      {/* Spacer - pushes controls to bottom */}
      <div className="flex-1 min-h-0" />

      {/* Controls Section - anchored to bottom */}
      <Stack gap="lg" className="px-8 pb-8 pt-4 shrink-0">
        {/* Progress Bar */}
        <div>
          <div
            role="slider"
            aria-label={I18n.player.progress.ariaLabel}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(currentTime)}
            aria-valuetext={`${formatDuration(currentTime)} / ${formatDuration(duration)}`}
            tabIndex={0}
            className="h-1.5 w-full cursor-pointer rounded-full bg-secondary hover:h-2 transition-all"
            onClick={handleProgressClick}
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <Stack direction="horizontal" justify="between" className="mt-2">
            <Text as="span" variant="caption" color="muted">{formatDuration(currentTime)}</Text>
            <Text as="span" variant="caption" color="muted">{formatDuration(duration)}</Text>
          </Stack>
        </div>

        {/* Primary Controls */}
        <Stack direction="horizontal" align="center" justify="center" gap="lg">
          <Button
            variant="outline"
            size="icon"
            onClick={previous}
            aria-label={I18n.player.controls.previous}
            className="h-14 w-14 rounded-full border-2"
          >
            <SkipBack className="h-6 w-6" aria-hidden="true" />
          </Button>

          <Button
            variant="default"
            size="icon"
            onClick={togglePlayPause}
            aria-label={isPlaying ? I18n.player.controls.pause : I18n.player.controls.play}
            className="h-20 w-20 rounded-full shadow-lg"
          >
            {isPlaying ? (
              <Pause className="h-10 w-10" aria-hidden="true" />
            ) : (
              <Play className="h-10 w-10 translate-x-0.5" aria-hidden="true" />
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            aria-label={I18n.player.controls.next}
            className="h-14 w-14 rounded-full border-2"
          >
            <SkipForward className="h-6 w-6" aria-hidden="true" />
          </Button>
        </Stack>

        {/* Secondary Controls */}
        <Stack direction="horizontal" align="center" justify="around" className="px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleShuffle}
            aria-pressed={isShuffled}
            aria-label={I18n.player.shuffle.label}
            className={isShuffled ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'hover:bg-accent'}
          >
            <Shuffle className="h-5 w-5 mr-1.5" aria-hidden="true" />
            <Text as="span" variant="caption">{I18n.player.shuffle.label}</Text>
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleToggleFavorite}
            aria-pressed={isFavorited}
            aria-label={isFavorited ? I18n.player.favorite.removeLabel : I18n.player.favorite.addLabel}
            className={isFavorited ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'hover:bg-accent'}
          >
            <Heart className={`h-5 w-5 mr-1.5 ${isFavorited ? 'fill-current' : ''}`} aria-hidden="true" />
            <Text as="span" variant="caption">{I18n.player.favorite.label}</Text>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleRepeat}
            aria-label={I18n.player.repeat.label}
            className={repeatMode !== RepeatMode.Off ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'hover:bg-accent'}
          >
            <div className="relative">
              <Repeat className="h-5 w-5 mr-1.5" aria-hidden="true" />
              {repeatMode === RepeatMode.One && (
                <Text as="span" variant="caption" className="absolute -top-1 -right-1 text-[10px] font-bold">1</Text>
              )}
            </div>
            <Text as="span" variant="caption">
              {repeatMode === RepeatMode.Off ? I18n.player.repeat.off : repeatMode === RepeatMode.All ? I18n.player.repeat.all : I18n.player.repeat.one}
            </Text>
          </Button>
        </Stack>
      </Stack>
    </div>
  );
}
