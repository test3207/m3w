/**
 * Full Player Component
 * Full-screen music player overlay
 */

import { useMemo, useEffect } from 'react';
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
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 shrink-0">
        <Button variant="ghost" size="icon" onClick={handleClose}>
          <ChevronDown className="h-6 w-6" />
        </Button>
        <div className="text-sm text-muted-foreground">
          {queueSourceName || I18n.player.playQueue.fallbackSource}
        </div>
        <Button variant="ghost" size="icon" onClick={handleOpenQueue}>
          <ListMusic className="h-5 w-5" />
        </Button>
      </div>

      {/* Album Cover */}
      <div className="flex justify-center px-8 py-4 shrink-0">
        <div className="aspect-square w-full max-w-[280px] overflow-hidden rounded-lg shadow-2xl">
          {currentSong.coverUrl ? (
            <img
              src={currentSong.coverUrl}
              alt={currentSong.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <Music className="h-20 w-20 text-muted-foreground/30" />
            </div>
          )}
        </div>
      </div>

      {/* Song Info */}
      <div className="px-8 py-4 text-center shrink-0">
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

      {/* Spacer - pushes controls to bottom */}
      <div className="flex-1 min-h-0" />

      {/* Controls Section - anchored to bottom */}
      <div className="px-8 pb-8 pt-4 shrink-0 space-y-6">
        {/* Progress Bar */}
        <div>
          <div
            className="h-1.5 w-full cursor-pointer rounded-full bg-secondary hover:h-2 transition-all"
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

        {/* Primary Controls */}
        <div className="flex items-center justify-center gap-6">
          <Button
            variant="outline"
            size="icon"
            onClick={previous}
            className="h-14 w-14 rounded-full border-2"
          >
            <SkipBack className="h-6 w-6" />
          </Button>

          <Button
            variant="default"
            size="icon"
            onClick={togglePlayPause}
            className="h-20 w-20 rounded-full shadow-lg"
          >
            {isPlaying ? (
              <Pause className="h-10 w-10" />
            ) : (
              <Play className="h-10 w-10 translate-x-0.5" />
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            className="h-14 w-14 rounded-full border-2"
          >
            <SkipForward className="h-6 w-6" />
          </Button>
        </div>

        {/* Secondary Controls */}
        <div className="flex items-center justify-around px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleShuffle}
            className={isShuffled ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'hover:bg-accent'}
          >
            <Shuffle className="h-5 w-5 mr-1.5" />
            <span className="text-xs">{I18n.player.shuffle.label}</span>
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleToggleFavorite}
            className={isFavorited ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'hover:bg-accent'}
          >
            <Heart className={`h-5 w-5 mr-1.5 ${isFavorited ? 'fill-current' : ''}`} />
            <span className="text-xs">{I18n.player.favorite.label}</span>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleRepeat}
            className={repeatMode !== 'off' ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'hover:bg-accent'}
          >
            <div className="relative">
              <Repeat className="h-5 w-5 mr-1.5" />
              {repeatMode === 'one' && (
                <span className="absolute -top-1 -right-1 text-[10px] font-bold">1</span>
              )}
            </div>
            <span className="text-xs">
              {repeatMode === 'off' ? I18n.player.repeat.off : repeatMode === 'all' ? I18n.player.repeat.all : I18n.player.repeat.one}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
