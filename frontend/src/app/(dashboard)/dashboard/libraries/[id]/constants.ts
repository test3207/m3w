export type AddSongToPlaylistState =
  | { status: "idle" }
  | { status: "success"; playlistId: string; songId: string }
  | { status: "error"; message: "invalid-input" | "unauthorized-or-missing" | "unknown" };

export const ADD_SONG_TO_PLAYLIST_INITIAL_STATE: AddSongToPlaylistState = {
  status: "idle",
};
