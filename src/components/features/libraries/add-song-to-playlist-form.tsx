import * as React from "react";
import { Button } from "@/components/ui/button";
import { I18n } from '@/locales/i18n';
import { toast } from "@/components/ui/use-toast";
import { logger } from "@/lib/logger-client";
import type { PlaylistOption } from "@/types/models";

interface AddSongToPlaylistFormProps {
  songId: string;
  songTitle: string;
  libraryId: string;
  playlists: PlaylistOption[];
}

function AddSongToPlaylistForm({ songId, songTitle, libraryId, playlists }: AddSongToPlaylistFormProps) {
  const [selectedPlaylistId, setSelectedPlaylistId] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (playlists.length === 0) {
      setSelectedPlaylistId("");
    }
  }, [playlists]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    
    if (!selectedPlaylistId) {
      toast({
        variant: "destructive",
        title: I18n.library.addToPlaylist.toastErrorTitle,
        description: I18n.library.addToPlaylist.selectPlaylistFirst,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/playlists/${selectedPlaylistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          songId,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const playlistName = playlists.find((playlist) => playlist.id === selectedPlaylistId)?.name;

        toast({
          title: I18n.library.addToPlaylist.toastSuccessTitle,
          description:
            playlistName !== undefined
              ? `${songTitle} → ${playlistName}`
              : I18n.library.addToPlaylist.toastSuccessDescription,
        });

        formRef.current?.reset();
        setSelectedPlaylistId("");
      } else {
        toast({
          variant: "destructive",
          title: I18n.library.addToPlaylist.toastErrorTitle,
          description: data.error || I18n.library.addToPlaylist.toastErrorDescription,
        });
      }
    } catch (error) {
      logger.error('Failed to add song to playlist', error);
      toast({
        variant: "destructive",
        title: I18n.library.addToPlaylist.toastErrorTitle,
        description: I18n.library.addToPlaylist.toastErrorDescription,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex items-center gap-2"
    >
      <label className="sr-only" htmlFor={`playlist-${songId}`}>
        {I18n.library.addToPlaylist.label}
      </label>
      <input type="hidden" name="songId" value={songId} />
      <input type="hidden" name="libraryId" value={libraryId} />
      <select
        id={`playlist-${songId}`}
        name="playlistId"
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        value={selectedPlaylistId}
        onChange={(event) => setSelectedPlaylistId(event.target.value)}
        disabled={playlists.length === 0 || isSubmitting}
      >
        <option value="" disabled>
          {I18n.library.addToPlaylist.placeholder}
        </option>
        {playlists.map((playlist) => (
          <option key={playlist.id} value={playlist.id}>
            {playlist.name}
          </option>
        ))}
      </select>
      <Button 
        type="submit" 
        size="sm" 
        variant="secondary" 
        disabled={playlists.length === 0 || selectedPlaylistId === "" || isSubmitting}
      >
        {isSubmitting
          ? I18n.library.addToPlaylist.pendingLabel
          : I18n.library.addToPlaylist.submitLabel}
      </Button>
    </form>
  );
}

export { AddSongToPlaylistForm };
