"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { LIBRARY_TEXT } from "@/locales/messages";
import { toast } from "@/components/ui/use-toast";
import { addSongToPlaylistAction } from "@/app/(dashboard)/dashboard/libraries/[id]/actions";
import {
  ADD_SONG_TO_PLAYLIST_INITIAL_STATE,
  type AddSongToPlaylistState,
} from "@/app/(dashboard)/dashboard/libraries/[id]/constants";

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

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" variant="secondary" disabled={disabled || pending}>
      {pending
        ? LIBRARY_TEXT.addToPlaylist.pendingLabel
        : LIBRARY_TEXT.addToPlaylist.submitLabel}
    </Button>
  );
}

function AddSongToPlaylistForm({ songId, songTitle, libraryId, playlists }: AddSongToPlaylistFormProps) {
  const [state, formAction] = React.useActionState<AddSongToPlaylistState, FormData>(
    addSongToPlaylistAction,
    ADD_SONG_TO_PLAYLIST_INITIAL_STATE
  );
  const [selectedPlaylistId, setSelectedPlaylistId] = React.useState<string>("");
  const formRef = React.useRef<HTMLFormElement>(null);
  const previousStatus = React.useRef<AddSongToPlaylistState["status"]>("idle");

  React.useEffect(() => {
    if (playlists.length === 0) {
      setSelectedPlaylistId("");
    }
  }, [playlists]);

  React.useEffect(() => {
    if (state.status === previousStatus.current) {
      return;
    }

    previousStatus.current = state.status;

    if (state.status === "success") {
      const playlistName = playlists.find((playlist) => playlist.id === state.playlistId)?.name;

      toast({
        title: LIBRARY_TEXT.addToPlaylist.toastSuccessTitle,
        description:
          playlistName !== undefined
            ? `${songTitle} → ${playlistName}`
            : LIBRARY_TEXT.addToPlaylist.toastSuccessDescription,
      });

      formRef.current?.reset();
      setSelectedPlaylistId("");
    }

    if (state.status === "error") {
      toast({
        variant: "destructive",
        title: LIBRARY_TEXT.addToPlaylist.toastErrorTitle,
        description: LIBRARY_TEXT.addToPlaylist.toastErrorDescription,
      });
    }
  }, [state, playlists, songTitle]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex items-center gap-2"
      onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
        if (!selectedPlaylistId) {
          event.preventDefault();
          toast({
            variant: "destructive",
            title: LIBRARY_TEXT.addToPlaylist.toastErrorTitle,
            description: LIBRARY_TEXT.addToPlaylist.selectPlaylistFirst,
          });
        }
      }}
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
        disabled={playlists.length === 0}
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
      <SubmitButton disabled={playlists.length === 0 || selectedPlaylistId === ""} />
    </form>
  );
}

export { AddSongToPlaylistForm };
