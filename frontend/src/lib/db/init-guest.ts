import { db } from "./schema";
import type { OfflineLibrary, OfflinePlaylist } from "./schema";
import { GUEST_USER_ID } from "../constants/guest";
import { generateUUID } from "../utils/uuid";

export async function initGuestResources() {
  const userId = GUEST_USER_ID;
  const now = new Date().toISOString();

  // 1. Check if default library exists
  const existingLibrary = await db.libraries
    .where("userId")
    .equals(userId)
    .filter(l => l.isDefault)
    .first();

  if (!existingLibrary) {
    const defaultLibrary: OfflineLibrary = {
      id: generateUUID(),
      name: "Default Library",
      description: null,
      userId,
      songCount: 0,
      isDefault: true,
      canDelete: false,
      cacheOverride: "inherit",  // Follow global setting
      coverSongId: null,  // No songs yet
      createdAt: now,
      updatedAt: now,
    };
    await db.libraries.add(defaultLibrary);
  }

  // 2. Check if favorites playlist exists
  const existingPlaylist = await db.playlists
    .where("userId")
    .equals(userId)
    .filter(p => p.isDefault)
    .first();

  if (!existingPlaylist) {
    const favoritesPlaylist: OfflinePlaylist = {
      id: generateUUID(),
      name: "My Favorites",
      description: null,
      userId,
      songCount: 0,
      linkedLibraryId: null,
      isDefault: true,
      canDelete: false,
      coverSongId: null,  // No songs yet
      createdAt: now,
      updatedAt: now,
    };
    await db.playlists.add(favoritesPlaylist);
  }
}
