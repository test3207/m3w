/**
 * Offline Playlist Service
 * 
 * Encapsulates IndexedDB operations for playlists in guest/offline mode.
 */

import { db } from "../../db/schema";
import type { OfflinePlaylist, OfflinePlaylistSong } from "../../db/schema";
import { generateUUID } from "../../utils/uuid";

/**
 * Get first song's ID for a playlist cover
 * Frontend uses buildCoverUrl(coverSongId) to construct the cover URL
 */
export async function getPlaylistCoverSongId(playlistId: string): Promise<string | null> {
  const playlistSongs = await db.playlistSongs
    .where("playlistId")
    .equals(playlistId)
    .toArray();
  const sortedSongs = playlistSongs.sort((a, b) => a.order - b.order);
  
  const firstPlaylistSong = sortedSongs[0];
  if (!firstPlaylistSong) return null;
  
  return firstPlaylistSong.songId;
}

/**
 * Get all playlists for a user
 * Includes coverSongId (first song's ID) for frontend to build cover URL
 */
export async function getUserPlaylistsWithCovers(userId: string) {
  const playlists = await db.playlists
    .where("userId")
    .equals(userId)
    .reverse()
    .sortBy("createdAt");

  return Promise.all(
    playlists.map(async (playlist) => {
      const coverSongId = await getPlaylistCoverSongId(playlist.id);
      return { ...playlist, coverSongId };
    })
  );
}

/**
 * Get playlist by ID if owned by user
 */
export async function getPlaylistById(playlistId: string, userId: string) {
  const playlist = await db.playlists.get(playlistId);
  if (!playlist || playlist.userId !== userId) return null;

  const coverSongId = await getPlaylistCoverSongId(playlistId);
  return { ...playlist, coverSongId };
}

/**
 * Get playlist linked to a library
 */
export async function getPlaylistByLibraryId(libraryId: string, userId: string) {
  const playlist = await db.playlists
    .where("linkedLibraryId")
    .equals(libraryId)
    .first();

  if (!playlist || playlist.userId !== userId) return null;
  return playlist;
}

interface CreatePlaylistInput {
  name: string;
  description?: string | null;
  linkedLibraryId?: string | null;
  songIds?: string[];
}

/**
 * Create a new playlist
 */
export async function createPlaylist(userId: string, input: CreatePlaylistInput): Promise<OfflinePlaylist> {
  const playlist: OfflinePlaylist = {
    id: generateUUID(),
    name: input.name,
    description: input.description ?? null,
    userId,
    songCount: input.songIds?.length || 0,
    linkedLibraryId: input.linkedLibraryId ?? null,
    isDefault: false,
    canDelete: true,
    coverSongId: input.songIds?.[0] ?? null,  // First song as cover
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.playlists.add(playlist);

  // Add playlist songs if provided
  if (input.songIds && input.songIds.length > 0) {
    const playlistSongsData: OfflinePlaylistSong[] = input.songIds.map((songId, index) => ({
      playlistId: playlist.id,
      songId,
      order: index,
      addedAt: new Date().toISOString(),
    }));
    await db.playlistSongs.bulkAdd(playlistSongsData);
  }

  return playlist;
}

/**
 * Update a playlist
 */
export async function updatePlaylist(
  playlistId: string,
  userId: string,
  data: { name?: string; description?: string | null }
): Promise<OfflinePlaylist | null> {
  const playlist = await db.playlists.get(playlistId);
  if (!playlist || playlist.userId !== userId) return null;

  const updated: OfflinePlaylist = {
    ...playlist,
    ...data,
    updatedAt: new Date().toISOString(),
  };

  await db.playlists.put(updated);
  return updated;
}

/**
 * Delete a playlist and its song relationships
 */
export async function deletePlaylist(playlistId: string, userId: string): Promise<boolean> {
  const playlist = await db.playlists.get(playlistId);
  if (!playlist || playlist.userId !== userId) return false;

  await db.playlists.delete(playlistId);
  await db.playlistSongs.where("playlistId").equals(playlistId).delete();
  return true;
}

/**
 * Get songs in a playlist with library names
 */
export async function getPlaylistSongs(playlistId: string, userId: string) {
  const playlist = await db.playlists.get(playlistId);
  if (!playlist || playlist.userId !== userId) return null;

  const playlistSongs = await db.playlistSongs
    .where("playlistId")
    .equals(playlistId)
    .toArray();
  const sortedPlaylistSongs = playlistSongs.sort((a, b) => a.order - b.order);

  const songs = await Promise.all(
    sortedPlaylistSongs.map(async (ps) => {
      const song = await db.songs.get(ps.songId);
      if (!song) return undefined;

      let libraryName = song.libraryName;
      if (!libraryName && song.libraryId) {
        const library = await db.libraries.get(song.libraryId);
        libraryName = library?.name ?? null;
      }

      return { ...song, libraryName };
    })
  );

  return songs.filter((song) => song !== undefined);
}

/**
 * Add a song to a playlist
 */
export async function addSongToPlaylist(
  playlistId: string,
  songId: string,
  userId: string
): Promise<{ success: boolean; error?: string; data?: { playlistId: string; songId: string; newSongCount: number } }> {
  const playlist = await db.playlists.get(playlistId);
  if (!playlist || playlist.userId !== userId) {
    return { success: false, error: "Playlist not found" };
  }

  const song = await db.songs.get(songId);
  if (!song) {
    return { success: false, error: "Song not found" };
  }

  // Check if already in playlist
  const existingEntry = await db.playlistSongs
    .where("[playlistId+songId]")
    .equals([playlistId, songId])
    .first();

  if (existingEntry) {
    return { success: false, error: "Song is already in playlist" };
  }

  // Get current max order
  const existingSongs = await db.playlistSongs
    .where("playlistId")
    .equals(playlistId)
    .toArray();
  const maxOrder = existingSongs.length > 0 ? Math.max(...existingSongs.map((ps) => ps.order)) : -1;

  // Add to playlist
  const playlistSong: OfflinePlaylistSong = {
    playlistId,
    songId,
    order: maxOrder + 1,
    addedAt: new Date().toISOString(),
  };

  await db.playlistSongs.add(playlistSong);

  const newSongCount = existingSongs.length + 1;

  await db.playlists.update(playlistId, {
    songCount: newSongCount,
    updatedAt: new Date().toISOString(),
  });

  return { success: true, data: { playlistId, songId, newSongCount } };
}

/**
 * Reorder songs in a playlist
 */
export async function reorderPlaylistSongs(
  playlistId: string,
  songIds: string[],
  userId: string
): Promise<{ success: boolean; error?: string; data?: { playlistId: string; songCount: number; updatedAt: string } }> {
  const playlist = await db.playlists.get(playlistId);
  if (!playlist || playlist.userId !== userId) {
    return { success: false, error: "Playlist not found" };
  }

  // Validate all songIds exist
  const songs = await db.songs.bulkGet(songIds);
  const validSongIds = songs.filter((s) => s !== undefined).map((s) => s!.id);

  if (validSongIds.length !== songIds.length) {
    return { success: false, error: "Invalid song order" };
  }

  // Update order
  const allPlaylistSongs = await db.playlistSongs
    .where("playlistId")
    .equals(playlistId)
    .toArray();

  const orderMap = new Map(songIds.map((songId, index) => [songId, index]));
  const updatedEntries = allPlaylistSongs.map((ps) => {
    const newOrder = orderMap.get(ps.songId);
    if (newOrder !== undefined) {
      return { ...ps, order: newOrder };
    }
    return ps;
  });

  await db.playlistSongs.bulkPut(updatedEntries);

  const updatedAt = new Date().toISOString();
  await db.playlists.update(playlistId, { updatedAt });

  return { success: true, data: { playlistId, songCount: songIds.length, updatedAt } };
}

/**
 * Replace all songs in a playlist
 */
export async function replacePlaylistSongs(
  playlistId: string,
  songIds: string[],
  userId: string
): Promise<boolean> {
  const playlist = await db.playlists.get(playlistId);
  if (!playlist || playlist.userId !== userId) return false;

  await db.transaction("rw", db.playlistSongs, db.playlists, async () => {
    // Delete existing
    await db.playlistSongs.where("playlistId").equals(playlistId).delete();

    // Add new songs
    if (songIds && songIds.length > 0) {
      const playlistSongsData: OfflinePlaylistSong[] = songIds.map((songId, index) => ({
        playlistId,
        songId,
        order: index,
        addedAt: new Date().toISOString(),
      }));
      await db.playlistSongs.bulkPut(playlistSongsData);
    }

    // Update playlist
    await db.playlists.update(playlistId, {
      songCount: songIds?.length || 0,
      updatedAt: new Date().toISOString(),
    });
  });

  return true;
}

/**
 * Remove a song from a playlist
 */
export async function removeSongFromPlaylist(
  playlistId: string,
  songId: string,
  userId: string
): Promise<{ success: boolean; error?: string; data?: { playlistId: string; songId: string; newSongCount: number } }> {
  const playlist = await db.playlists.get(playlistId);
  if (!playlist || playlist.userId !== userId) {
    return { success: false, error: "Playlist not found" };
  }

  const playlistSong = await db.playlistSongs
    .where("[playlistId+songId]")
    .equals([playlistId, songId])
    .first();

  if (!playlistSong) {
    return { success: false, error: "Song not in playlist" };
  }

  const currentCount = await db.playlistSongs.where("playlistId").equals(playlistId).count();

  await db.playlistSongs.delete([playlistSong.playlistId, playlistSong.songId]);

  const newSongCount = Math.max(0, currentCount - 1);

  await db.playlists.update(playlistId, {
    songCount: newSongCount,
    updatedAt: new Date().toISOString(),
  });

  return { success: true, data: { playlistId, songId, newSongCount } };
}
