'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAudioPlayer } from '@/lib/audio/useAudioPlayer';
import type { Track } from '@/lib/audio/player';
import type { PlayContext } from '@/lib/audio/context';
import { PLAYLIST_TEXT } from '@/locales/messages';
import { logger } from '@/lib/logger-client';

interface PlaylistPlayButtonProps {
  playlistId: string;
  playlistName: string;
}

interface PlaylistTrackResponse {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  coverUrl: string | null;
  duration: number | null;
  mimeType: string | null;
}

export function PlaylistPlayButton({ playlistId, playlistName }: PlaylistPlayButtonProps) {
  const { playFromQueue } = useAudioPlayer();
  const [isLoading, setIsLoading] = useState(false);

  const handlePlay = async () => {
    try {
      setIsLoading(true);

      const tracksResponse = await fetch(`/api/playlists/${playlistId}/tracks`, {
        cache: 'no-store',
      });

      if (!tracksResponse.ok) {
        logger.error('Failed to load playlist tracks', { playlistId });
        return;
      }

      const data = await tracksResponse.json();
      const tracks: PlaylistTrackResponse[] = data.tracks ?? [];

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
          audioUrl: `/api/songs/${track.id}/stream`,
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
      aria-label={`${PLAYLIST_TEXT.controls.playButtonAriaPrefix}${playlistName}`}
    >
      {isLoading ? PLAYLIST_TEXT.controls.playButtonLoading : PLAYLIST_TEXT.controls.playButtonLabel}
    </Button>
  );
}
