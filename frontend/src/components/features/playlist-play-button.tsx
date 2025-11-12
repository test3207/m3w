'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import type { Track } from '@/lib/audio/player';
import type { PlayContext } from '@/lib/audio/context';
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';
import { logger } from '@/lib/logger-client';
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/constants/api-config';
import type { PlaylistTrackResponse } from '@/types/models';

interface PlaylistPlayButtonProps {
  playlistId: string;
  playlistName: string;
}

export function PlaylistPlayButton({ playlistId, playlistName }: PlaylistPlayButtonProps) {
  useLocale(); // Subscribe to locale changes
  const { playFromQueue } = useAudioPlayer();
  const [isLoading, setIsLoading] = useState(false);

  const handlePlay = async () => {
    try {
      setIsLoading(true);

      const response = await apiClient.get<{ success: boolean; data: PlaylistTrackResponse[] }>(
        API_ENDPOINTS.playlists.songs(playlistId)
      );
      
      const tracks = response.data ?? [];

      if (tracks.length === 0) {
        logger.warn('Playlist has no tracks', { playlistId });
        return;
      }

      const tracksWithAudio: Track[] = [];

      for (const track of tracks) {
        tracksWithAudio.push({
          id: track.id,
          title: track.title,
          artist: track.artist ?? undefined,
          album: track.album ?? undefined,
          coverUrl: track.coverUrl ?? undefined,
          duration: track.duration ?? undefined,
          audioUrl: API_ENDPOINTS.songs.stream(track.id),
          mimeType: track.mimeType ?? undefined,
        });
      }

      if (tracksWithAudio.length === 0) {
        logger.warn('No playable tracks in playlist', { playlistId });
        return;
      }

      const context: PlayContext = {
        type: 'playlist',
        id: playlistId,
        name: playlistName,
      };

      await playFromQueue(tracksWithAudio, 0, context);
    } catch (error) {
      logger.error('Failed to start playlist playback', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handlePlay}
      disabled={isLoading}
      aria-label={`${I18n.playlist.controls.playButtonAriaPrefix}${playlistName}`}
    >
      {isLoading ? I18n.playlist.controls.playButtonLoading : I18n.playlist.controls.playButtonLabel}
    </Button>
  );
}
