"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/config";
import { addSongToPlaylist } from "@/lib/services/playlist.service";
import type { AddSongToPlaylistState } from "./constants";

export async function addSongToPlaylistAction(
  _prevState: AddSongToPlaylistState,
  formData: FormData
): Promise<AddSongToPlaylistState> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const playlistId = formData.get("playlistId");
  const songId = formData.get("songId");
  const libraryId = formData.get("libraryId");

  if (
    typeof playlistId !== "string" ||
    playlistId.trim() === "" ||
    typeof songId !== "string" ||
    typeof libraryId !== "string"
  ) {
    return { status: "error", message: "invalid-input" };
  }

  try {
    const relation = await addSongToPlaylist(playlistId, songId, session.user.id);

    if (!relation) {
      return { status: "error", message: "unauthorized-or-missing" };
    }

    revalidatePath(`/dashboard/libraries/${libraryId}`);
    revalidatePath("/dashboard/playlists");

    return { status: "success", playlistId, songId };
  } catch {
    return { status: "error", message: "unknown" };
  }
}
