import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import type { Track } from "@/lib/audio/player";
import type { PlayContext } from "@/lib/audio/context";
import { I18n } from "@/locales/i18n";
import { logger } from "@/lib/logger-client";
import { api } from "@/services";
import { MAIN_API_ENDPOINTS } from "@/services/api/main/endpoints";
import { buildCoverUrl } from "@/lib/utils/url";

interface PlaylistPlayButtonProps {
  playlistId: string;
  playlistName: string;
}

export function PlaylistPlayButton({ playlistId, playlistName }: PlaylistPlayButtonProps) {
  const { playFromQueue } = useAudioPlayer();
  const [isLoading, setIsLoading] = useState(false);

  const handlePlay = async () => {
    try {
      setIsLoading(true);

      const tracks = await api.main.playlists.getSongs(playlistId);

      if (tracks.length === 0) {
        logger.warn("[PlaylistPlayButton][handlePlay]", "Playlist has no tracks", { raw: { playlistId } });
        return;
      }

      const tracksWithAudio: Track[] = [];

      for (const track of tracks) {
        tracksWithAudio.push({
          id: track.id,
          title: track.title,
          artist: track.artist ?? undefined,
          album: track.album ?? undefined,
          coverUrl: buildCoverUrl(track.id),
          duration: track.duration ?? undefined,
          audioUrl: MAIN_API_ENDPOINTS.songs.stream(track.id),
          mimeType: track.mimeType ?? "audio/mpeg",
        });
      }

      if (tracksWithAudio.length === 0) {
        logger.warn("[PlaylistPlayButton][handlePlay]", "No playable tracks in playlist", { raw: { playlistId } });
        return;
      }

      const context: PlayContext = {
        type: "playlist",
        id: playlistId,
        name: playlistName,
      };

      await playFromQueue(tracksWithAudio, 0, context);
    } catch (error) {
      logger.error("[PlaylistPlayButton][handlePlay]", "Failed to start playlist playback", error);
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
