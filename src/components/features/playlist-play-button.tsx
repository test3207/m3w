'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAudioPlayer } from '@/lib/audio/useAudioPlayer';
import type { Track } from '@/lib/audio/player';
import type { PlayContext } from '@/lib/audio/context';

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
        console.error('Failed to load playlist tracks');
        return;
      }

      const data = await tracksResponse.json();
      const tracks: PlaylistTrackResponse[] = data.tracks ?? [];

      if (tracks.length === 0) {
        console.warn('Playlist has no tracks');
        return;
      }

      const tracksWithAudio: Track[] = [];

      for (const track of tracks) {
        const streamResponse = await fetch(`/api/songs/${track.id}/stream`, {
          cache: 'no-store',
        });

        if (!streamResponse.ok) {
          console.error('Failed to generate stream URL for track', track.id);
          continue;
        }

        const streamData = await streamResponse.json();

        tracksWithAudio.push({
          id: track.id,
          title: track.title,
          artist: track.artist ?? undefined,
          album: track.album ?? undefined,
          coverUrl: track.coverUrl ?? undefined,
          duration: track.duration ?? undefined,
          audioUrl: streamData.url,
        });
      }

      if (tracksWithAudio.length === 0) {
        console.warn('No playable tracks in playlist');
        return;
      }

      const context: PlayContext = {
        type: 'playlist',
        id: playlistId,
        name: playlistName,
      };

      await playFromQueue(tracksWithAudio, 0, context);
    } catch (error) {
      console.error('Failed to start playlist playback', error);
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
      aria-label={`Play playlist ${playlistName}`}
    >
      {isLoading ? 'Loading...' : 'Play'}
    </Button>
  );
}
