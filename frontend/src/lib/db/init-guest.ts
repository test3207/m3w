import { db } from './schema';
import type { OfflineLibrary, OfflinePlaylist } from './schema';

export async function initGuestResources() {
  const userId = 'guest';
  const now = new Date().toISOString();

  // 1. Check if default library exists
  const existingLibrary = await db.libraries
    .where('userId')
    .equals(userId)
    .filter(l => l.isDefault)
    .first();

  if (!existingLibrary) {
    const defaultLibrary: OfflineLibrary = {
      id: crypto.randomUUID(),
      name: 'Default Library',
      description: null,
      userId,
      isDefault: true,
      canDelete: false,
      createdAt: now,
      updatedAt: now,
      _count: { songs: 0 },
      _syncStatus: 'synced' // Local data is considered synced in guest mode
    };
    await db.libraries.add(defaultLibrary);
  }

  // 2. Check if favorites playlist exists
  const existingPlaylist = await db.playlists
    .where('userId')
    .equals(userId)
    .filter(p => p.isDefault)
    .first();

  if (!existingPlaylist) {
    const favoritesPlaylist: OfflinePlaylist = {
      id: crypto.randomUUID(),
      name: 'My Favorites',
      description: null,
      userId,
      songIds: [],
      isDefault: true,
      canDelete: false,
      createdAt: now,
      updatedAt: now,
      _count: { songs: 0 },
      _syncStatus: 'synced'
    };
    await db.playlists.add(favoritesPlaylist);
  }
}
