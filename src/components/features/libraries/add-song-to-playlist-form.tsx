import * as React from "react";
import { Button } from "@/components/ui/button";
import { LIBRARY_TEXT } from "@/locales/messages";
import { toast } from "@/components/ui/use-toast";
import { logger } from "@/lib/logger-client";

interface PlaylistOption {
  id: string;
  name: string;
}

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
        title: LIBRARY_TEXT.addToPlaylist.toastErrorTitle,
        description: LIBRARY_TEXT.addToPlaylist.selectPlaylistFirst,
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
          title: LIBRARY_TEXT.addToPlaylist.toastSuccessTitle,
          description:
            playlistName !== undefined
              ? `${songTitle} → ${playlistName}`
              : LIBRARY_TEXT.addToPlaylist.toastSuccessDescription,
        });

        formRef.current?.reset();
        setSelectedPlaylistId("");
      } else {
        toast({
          variant: "destructive",
          title: LIBRARY_TEXT.addToPlaylist.toastErrorTitle,
          description: data.error || LIBRARY_TEXT.addToPlaylist.toastErrorDescription,
        });
      }
    } catch (error) {
      logger.error('Failed to add song to playlist', error);
      toast({
        variant: "destructive",
        title: LIBRARY_TEXT.addToPlaylist.toastErrorTitle,
        description: LIBRARY_TEXT.addToPlaylist.toastErrorDescription,
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
        {LIBRARY_TEXT.addToPlaylist.label}
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
          {LIBRARY_TEXT.addToPlaylist.placeholder}
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
          ? LIBRARY_TEXT.addToPlaylist.pendingLabel
          : LIBRARY_TEXT.addToPlaylist.submitLabel}
      </Button>
    </form>
  );
}

export { AddSongToPlaylistForm };
