"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/config";
import {
  getPlaylistById,
  removeSongFromPlaylist,
  reorderPlaylistSongs,
} from "@/lib/services/playlist.service";

export type PlaylistSongActionResult =
  | { status: "success"; action: "remove" | "move"; songId: string; direction?: "up" | "down" }
  | { status: "error"; message: "playlist-not-found" | "song-not-found" | "invalid-direction" | "unknown" };

export interface RemoveSongInput {
  playlistId: string;
  songId: string;
}

export interface MoveSongInput {
  playlistId: string;
  songId: string;
  direction: "up" | "down";
}

export async function removeSongAction(input: RemoveSongInput): Promise<PlaylistSongActionResult> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const result = await removeSongFromPlaylist(input.playlistId, input.songId, session.user.id);

  if (!result) {
    return { status: "error", message: "playlist-not-found" };
  }

  revalidatePath(`/dashboard/playlists/${input.playlistId}`);
  revalidatePath("/dashboard/playlists");

  return { status: "success", action: "remove", songId: input.songId };
}

export async function moveSongAction(input: MoveSongInput): Promise<PlaylistSongActionResult> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const playlist = await getPlaylistById(input.playlistId, session.user.id);

  if (!playlist) {
    return { status: "error", message: "playlist-not-found" };
  }

  const order = playlist.songs.map((entry) => entry.songId);
  const currentIndex = order.indexOf(input.songId);

  if (currentIndex === -1) {
    return { status: "error", message: "song-not-found" };
  }

  if (input.direction === "up" && currentIndex > 0) {
    [order[currentIndex - 1], order[currentIndex]] = [order[currentIndex], order[currentIndex - 1]];
  } else if (input.direction === "down" && currentIndex < order.length - 1) {
    [order[currentIndex], order[currentIndex + 1]] = [order[currentIndex + 1], order[currentIndex]];
  } else {
    return { status: "error", message: "invalid-direction" };
  }

  const reorderResult = await reorderPlaylistSongs(input.playlistId, session.user.id, order);

  if (!reorderResult?.success) {
    return { status: "error", message: "unknown" };
  }

  revalidatePath(`/dashboard/playlists/${input.playlistId}`);
  revalidatePath("/dashboard/playlists");

  return { status: "success", action: "move", songId: input.songId, direction: input.direction };
}
