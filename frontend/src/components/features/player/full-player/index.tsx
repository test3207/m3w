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
 * @see {@link GESTURE_CONFIG} - Swipe threshold and drag resistance settings
 * @see {@link ANIMATION_CONFIG} - Animation duration and easing
 * @see {@link animationReducer} - State machine for enter/exit animations
 */

import { useMemo, useEffect, useRef, useCallback, useState, useReducer } from "react";
import { useDrag } from "@use-gesture/react";
import { usePlayerStore } from "@/stores/playerStore";
import { usePlaylistStore } from "@/stores/playlistStore";
import { useUIStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { ChevronDown, ListMusic } from "lucide-react";
import { CoverImage, CoverType, CoverSize } from "@/components/ui/cover-image";
import { I18n } from "@/locales/i18n";
import { logger } from "@/lib/logger-client";
import { Text } from "@/components/ui/text";
import { Stack } from "@/components/ui/stack";

import { GESTURE_CONFIG, ANIMATION_CONFIG, TRANSFORM } from "./constants";
import { AnimationPhase, ExitDirection, AnimationActionType, animationReducer } from "./types";
import { ProgressBar } from "./ProgressBar";
import { PlaybackControls } from "./PlaybackControls";

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
  const lastPlayedSong = usePlayerStore((state) => state.lastPlayedSong);

  const togglePlayPause = usePlayerStore((state) => state.togglePlayPause);
  const previous = usePlayerStore((state) => state.previous);
  const next = usePlayerStore((state) => state.next);
  const seek = usePlayerStore((state) => state.seek);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const toggleRepeat = usePlayerStore((state) => state.toggleRepeat);

  // Favorites functionality
  const playlists = usePlaylistStore((state) => state.playlists);
  const playlistSongIds = usePlaylistStore((state) => state.playlistSongIds);
  const toggleFavorite = usePlaylistStore((state) => state.toggleFavorite);
  const fetchPlaylists = usePlaylistStore((state) => state.fetchPlaylists);
  const getFavoritesPlaylist = usePlaylistStore((state) => state.getFavoritesPlaylist);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const rafIdsRef = useRef<number[]>([]);
  const historyStateIdRef = useRef<number>(0);

  // State
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [animationState, dispatch] = useReducer(
    animationReducer,
    { phase: isOpen ? AnimationPhase.Entering : AnimationPhase.Hidden, exitDirection: ExitDirection.Down }
  );
  const { phase: animationPhase, exitDirection } = animationState;

  // Handle isOpen changes
  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;
    let cancelled = false;

    if (isOpen && !wasOpen) {
      dispatch({ type: AnimationActionType.Open });
      const raf1 = requestAnimationFrame(() => {
        if (cancelled) return;
        const raf2 = requestAnimationFrame(() => {
          if (cancelled) return;
          dispatch({ type: AnimationActionType.OpenComplete });
        });
        rafIdsRef.current.push(raf2);
      });
      rafIdsRef.current.push(raf1);
    } else if (!isOpen && wasOpen) {
      dispatch({ type: AnimationActionType.Close, direction: ExitDirection.Down });
    }

    return () => {
      cancelled = true;
      rafIdsRef.current.forEach((id) => cancelAnimationFrame(id));
      rafIdsRef.current = [];
    };
  }, [isOpen]);

  const handleTransitionEnd = useCallback((e: React.TransitionEvent) => {
    if (e.propertyName === "transform" && e.target === containerRef.current) {
      if (animationPhase === AnimationPhase.Exiting) {
        dispatch({ type: AnimationActionType.CloseComplete });
        setDragOffset({ x: 0, y: 0 });
      }
    }
  }, [animationPhase]);

  const handleClose = useCallback(() => { closeFullPlayer(); }, [closeFullPlayer]);

  // History API for back button
  useEffect(() => {
    if (!isOpen) return;
    const stateId = Date.now();
    historyStateIdRef.current = stateId;
    window.history.pushState({ fullPlayerOpen: true, id: stateId }, "");

    const handlePopState = (event: PopStateEvent) => {
      if (!event.state?.fullPlayerOpen) handleClose();
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (window.history.state?.id === stateId) {
        window.history.replaceState(null, "");
      }
    };
  }, [isOpen, handleClose]);

  // Gesture handling with @use-gesture/react
  // Swipe left: next track, Swipe right: prev track
  // Swipe down: close, Swipe up: open queue
  // Note: All store actions (next, previous, closeFullPlayer, etc.) are stable references
  // from Zustand and useReducer dispatch, so no useCallback wrapper needed.
  const bind = useDrag(
    ({ movement: [mx, my], velocity: [vx, vy], direction: [dx, dy], last, cancel, event }) => {
      // Skip if interacting with slider or button
      const target = event?.target as HTMLElement;
      if (target?.closest("[role=\"slider\"]") || target?.closest("button")) {
        cancel();
        return;
      }

      const absX = Math.abs(mx);
      const absY = Math.abs(my);
      // Determine primary gesture direction early to avoid mixed feedback
      const isHorizontalGesture = absX > absY * 1.5; // 1.5x bias toward horizontal
      const isDownwardGesture = my > 0 && absY > absX * 1.5; // Only downward, not upward

      if (!last) {
        // During drag: show appropriate visual feedback based on gesture direction
        setIsDragging(true);
        if (isDownwardGesture) {
          // Vertical drag: show downward movement
          const offsetY = Math.max(0, my * GESTURE_CONFIG.DRAG_RESISTANCE);
          setDragOffset({ x: 0, y: offsetY });
        } else if (isHorizontalGesture) {
          // Horizontal drag: subtle horizontal feedback for track navigation
          const offsetX = mx * GESTURE_CONFIG.HORIZONTAL_DRAG_RESISTANCE;
          setDragOffset({ x: offsetX, y: 0 });
        } else {
          // Ambiguous gesture: no feedback until clear direction
          setIsDragging(false);
          setDragOffset({ x: 0, y: 0 });
        }
        return;
      }

      // On release: determine action
      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });

      // Horizontal swipe: track navigation (requires clear horizontal intent)
      if (isHorizontalGesture && (absX > GESTURE_CONFIG.SWIPE_THRESHOLD || Math.abs(vx) > GESTURE_CONFIG.VELOCITY_THRESHOLD)) {
        if (dx < 0) {
          // Swipe left → next track
          logger.debug("[FullPlayer][onDragEnd]", "Swipe left: next track");
          next();
        } else {
          // Swipe right → previous track
          logger.debug("[FullPlayer][onDragEnd]", "Swipe right: previous track");
          previous();
        }
        return;
      }

      // Vertical swipe: close or open queue (requires clear vertical intent)
      const isVerticalGesture = absY > absX * 1.5;
      if (isVerticalGesture && (absY > GESTURE_CONFIG.SWIPE_THRESHOLD || Math.abs(vy) > GESTURE_CONFIG.VELOCITY_THRESHOLD)) {
        if (dy > 0) {
          // Swipe down → close
          logger.debug("[FullPlayer][onDragEnd]", "Swipe down: close");
          dispatch({ type: AnimationActionType.Close, direction: ExitDirection.Down });
          setTimeout(() => closeFullPlayer(), 0);
        } else {
          // Swipe up → open queue
          logger.debug("[FullPlayer][onDragEnd]", "Swipe up: open queue");
          openPlayQueueDrawer();
        }
      }
    },
    {
      filterTaps: true,
      pointer: { touch: true },
    }
  );

  // Load playlists when opened
  useEffect(() => {
    if (isOpen && playlists.length === 0) fetchPlaylists();
  }, [isOpen, playlists.length, fetchPlaylists]);

  const isFavorited = useMemo(() => {
    if (!currentSong) return false;
    const favorites = getFavoritesPlaylist();
    if (!favorites) return false;
    const songIds = playlistSongIds[favorites.id] || [];
    return songIds.includes(currentSong.id);
  }, [currentSong, getFavoritesPlaylist, playlistSongIds]);

  const handleToggleFavorite = async () => {
    if (!currentSong) return;
    const wasFavorited = isFavorited;
    const wasSuccess = await toggleFavorite(currentSong.id);
    toast({
      title: wasSuccess
        ? wasFavorited ? I18n.player.favorite.removed : I18n.player.favorite.added
        : wasFavorited ? I18n.player.favorite.removeError : I18n.player.favorite.addError,
      variant: wasSuccess ? "default" : "destructive",
    });
  };

  const displaySong = currentSong || lastPlayedSong;
  // Fallback to song metadata duration when AudioPlayer hasn't loaded the track yet
  const displayDuration = duration > 0 ? duration : (displaySong?.duration ?? 0);
  if (animationPhase === AnimationPhase.Hidden || !displaySong) return null;

  // Transform calculations
  const getTransform = () => {
    if (isDragging && (dragOffset.x > 0 || dragOffset.y > 0)) {
      return `translate(${dragOffset.x}px, ${dragOffset.y}px)`;
    }
    if (animationPhase === AnimationPhase.Entering) return TRANSFORM.ENTER_START;
    if (animationPhase === AnimationPhase.Exiting) {
      return exitDirection === ExitDirection.Right ? TRANSFORM.EXIT_RIGHT : TRANSFORM.EXIT_DOWN;
    }
    return TRANSFORM.VISIBLE;
  };

  const shouldAnimate = !isDragging && (animationPhase === AnimationPhase.Visible || animationPhase === AnimationPhase.Exiting);
  const getOpacity = () => {
    if (!isDragging) return 1;
    const dragDistance = Math.max(dragOffset.x, dragOffset.y);
    return Math.max(GESTURE_CONFIG.MIN_DRAG_OPACITY, 1 - dragDistance / GESTURE_CONFIG.MAX_DRAG_FOR_OPACITY);
  };

  return (
    <div
      {...bind()}
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
          : "none",
        willChange: isDragging || animationPhase === AnimationPhase.Entering || animationPhase === AnimationPhase.Exiting
          ? "transform, opacity"
          : "auto",
      }}
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
        <Button variant="ghost" size="icon" onClick={openPlayQueueDrawer} aria-label={I18n.player.playQueue.open}>
          <ListMusic className="h-5 w-5" />
        </Button>
      </Stack>

      {/* Album Cover */}
      <Stack align="center" className="px-8 py-4 shrink-0">
        <div className="aspect-square w-full max-w-70 overflow-hidden rounded-lg shadow-2xl">
          <CoverImage
            songId={displaySong.id}
            alt={I18n.player.fullPlayer.albumCoverAlt}
            type={CoverType.Song}
            size={CoverSize.XL}
            className="h-full w-full max-w-none"
          />
        </div>
      </Stack>

      {/* Song Info */}
      <Stack gap="xs" align="center" className="px-8 py-4 shrink-0">
        <Text variant="h3" className="truncate w-full text-center">{displaySong.title}</Text>
        <Text variant="h5" color="muted" className="truncate w-full text-center">{displaySong.artist}</Text>
        {displaySong.album && (
          <Text variant="caption" color="muted" className="truncate w-full text-center">{displaySong.album}</Text>
        )}
      </Stack>

      {/* Spacer */}
      <div className="flex-1 min-h-0" />

      {/* Controls Section */}
      <Stack gap="lg" className="px-8 pb-8 pt-4 shrink-0">
        <ProgressBar currentTime={currentTime} duration={displayDuration} onSeek={seek} />
        <PlaybackControls
          isPlaying={isPlaying}
          isShuffled={isShuffled}
          repeatMode={repeatMode}
          isFavorited={isFavorited}
          onTogglePlayPause={togglePlayPause}
          onPrevious={previous}
          onNext={next}
          onToggleShuffle={toggleShuffle}
          onToggleRepeat={toggleRepeat}
          onToggleFavorite={handleToggleFavorite}
        />
      </Stack>
    </div>
  );
}
