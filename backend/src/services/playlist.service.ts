/**
 * Playlist Service
 * 
 * Database operations for playlists extracted from routes
 */

import { prisma } from '../lib/prisma';
import type { PlaylistInput, SongInput } from '@m3w/shared';

/**
 * Get cover song ID from first song in playlist
 */
export async function getPlaylistCoverSongId(playlistId: string): Promise<string | null> {
  const firstSong = await prisma.playlistSong.findFirst({
    where: { playlistId },
    orderBy: { order: 'asc' },
    include: {
      song: {
        select: { id: true },
      },
    },
  });
  return firstSong?.song?.id ?? null;
}

/**
 * Transform Prisma playlist to PlaylistInput format
 */
export function toPlaylistInput(
  playlist: {
    id: string;
    name: string;
    description: string | null;
    userId: string;
    songCount: number;
    linkedLibraryId: string | null;
    isDefault: boolean;
    canDelete: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  coverSongId: string | null
): PlaylistInput {
  return {
    ...playlist,
    coverSongId,
  };
}

/**
 * Find all playlists for a user with cover info
 */
export async function findUserPlaylists(userId: string) {
  return prisma.playlist.findMany({
    where: { userId },
    include: {
      songs: {
        take: 1,
        include: {
          song: {
            select: {
              id: true,
            },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Find playlist by ID with cover info
 */
export async function findPlaylistById(id: string, userId: string) {
  return prisma.playlist.findFirst({
    where: { id, userId },
    include: {
      songs: {
        take: 1,
        include: {
          song: {
            select: {
              id: true,
            },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  });
}

/**
 * Find playlist linked to a library
 */
export async function findPlaylistByLibrary(userId: string, libraryId: string) {
  return prisma.playlist.findFirst({
    where: {
      userId,
      linkedLibraryId: libraryId,
    },
  });
}

/**
 * Create a new playlist
 */
export async function createPlaylist(data: {
  name: string;
  description?: string;
  userId: string;
  linkedLibraryId?: string;
  canDelete?: boolean;
  songCount?: number;
}) {
  return prisma.playlist.create({
    data: {
      name: data.name,
      description: data.description,
      userId: data.userId,
      linkedLibraryId: data.linkedLibraryId,
      canDelete: data.canDelete ?? true,
      songCount: data.songCount ?? 0,
    },
  });
}

/**
 * Update a playlist
 */
export async function updatePlaylist(
  id: string,
  data: { name?: string; description?: string }
) {
  return prisma.playlist.update({
    where: { id },
    data,
    include: {
      songs: {
        take: 1,
        include: {
          song: {
            select: { id: true, coverUrl: true },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  });
}

/**
 * Delete a playlist (cascade deletes PlaylistSong entries)
 */
export async function deletePlaylist(id: string) {
  return prisma.playlist.delete({
    where: { id },
  });
}

/**
 * Get songs in a playlist ordered by position
 */
export async function getPlaylistSongs(playlistId: string): Promise<SongInput[]> {
  const playlistSongs = await prisma.playlistSong.findMany({
    where: { playlistId },
    orderBy: { order: 'asc' },
    include: {
      song: {
        select: {
          id: true,
          title: true,
          artist: true,
          album: true,
          albumArtist: true,
          year: true,
          genre: true,
          trackNumber: true,
          discNumber: true,
          composer: true,
          fileId: true,
          libraryId: true,
          createdAt: true,
          updatedAt: true,
          file: {
            select: {
              duration: true,
              mimeType: true,
            },
          },
          library: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return playlistSongs.map((ps) => ({
    ...ps.song,
  }));
}

/**
 * Check if a song exists and belongs to user's library
 */
export async function findUserSong(songId: string, userId: string) {
  return prisma.song.findFirst({
    where: {
      id: songId,
      library: {
        userId,
      },
    },
  });
}

/**
 * Check if a song is already in a playlist
 */
export async function findPlaylistSong(playlistId: string, songId: string) {
  return prisma.playlistSong.findUnique({
    where: {
      playlistId_songId: { playlistId, songId },
    },
  });
}

/**
 * Add a song to a playlist
 */
export async function addSongToPlaylist(playlistId: string, songId: string) {
  return prisma.$transaction(async (tx) => {
    // Get current max order inside transaction for consistency
    const maxOrderEntry = await tx.playlistSong.findFirst({
      where: { playlistId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const newOrder = (maxOrderEntry?.order ?? -1) + 1;

    // Create PlaylistSong entry
    await tx.playlistSong.create({
      data: {
        playlistId,
        songId,
        order: newOrder,
      },
    });

    // Increment songCount and return updated playlist
    return tx.playlist.update({
      where: { id: playlistId },
      data: { songCount: { increment: 1 } },
    });
  });
}

/**
 * Remove a song from a playlist
 */
export async function removeSongFromPlaylist(playlistId: string, songId: string) {
  return prisma.$transaction([
    prisma.playlistSong.delete({
      where: {
        playlistId_songId: { playlistId, songId },
      },
    }),
    prisma.playlist.update({
      where: { id: playlistId },
      data: { songCount: { decrement: 1 } },
    }),
  ]);
}

/**
 * Get all song IDs in a playlist
 */
export async function getPlaylistSongIds(playlistId: string) {
  const entries = await prisma.playlistSong.findMany({
    where: { playlistId },
    select: { songId: true },
  });
  return new Set(entries.map((e) => e.songId));
}

/**
 * Reorder songs in a playlist
 */
export async function reorderPlaylistSongs(playlistId: string, songIds: string[]) {
  // Batch update order using transaction
  await prisma.$transaction(
    songIds.map((songId, index) =>
      prisma.playlistSong.update({
        where: { playlistId_songId: { playlistId, songId } },
        data: { order: index },
      })
    )
  );

  // Update playlist timestamp
  return prisma.playlist.update({
    where: { id: playlistId },
    data: { updatedAt: new Date() },
  });
}

/**
 * Replace all songs in a playlist
 */
export async function replacePlaylistSongs(playlistId: string, songIds: string[]) {
  const newSongCount = songIds.length;

  return prisma.$transaction(async (tx) => {
    // Delete existing PlaylistSong entries
    await tx.playlistSong.deleteMany({
      where: { playlistId },
    });

    // Create new PlaylistSong entries
    if (songIds.length > 0) {
      const playlistSongData = songIds.map((songId, index) => ({
        playlistId,
        songId,
        order: index,
      }));

      await tx.playlistSong.createMany({
        data: playlistSongData,
      });
    }

    // Update playlist timestamp and songCount
    return tx.playlist.update({
      where: { id: playlistId },
      data: {
        updatedAt: new Date(),
        songCount: newSongCount,
      },
    });
  });
}

/**
 * Validate songs belong to a library
 */
export async function validateLibrarySongs(songIds: string[], libraryId: string, userId: string) {
  const validSongs = await prisma.song.findMany({
    where: {
      id: { in: songIds },
      libraryId,
      library: { userId },
    },
    select: { id: true },
  });
  return validSongs.length === songIds.length;
}

/**
 * Create playlist songs in batch
 */
export async function createPlaylistSongs(playlistId: string, songIds: string[]) {
  if (songIds.length === 0) return;

  const playlistSongData = songIds.map((songId, index) => ({
    playlistId,
    songId,
    order: index,
  }));

  return prisma.playlistSong.createMany({
    data: playlistSongData,
  });
}
