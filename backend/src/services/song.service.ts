/**
 * Song Service
 * Database operations for songs - extracted from routes for maintainability
 */

import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import type { SongSortOption } from '@m3w/shared';
import { getPinyinSort } from '../lib/pinyin-helper';

/**
 * Sort songs by given option
 * Supports date, title, artist, and album sorting with Pinyin support for Chinese
 */
export function sortSongs<T extends { title: string; artist: string | null; album: string | null; createdAt: Date }>(
  songs: T[],
  sortOption: SongSortOption
): T[] {
  const sorted = [...songs];

  switch (sortOption) {
    case 'title-asc':
      return sorted.sort((a, b) => {
        const aTitle = getPinyinSort(a.title);
        const bTitle = getPinyinSort(b.title);
        return aTitle.localeCompare(bTitle);
      });

    case 'title-desc':
      return sorted.sort((a, b) => {
        const aTitle = getPinyinSort(a.title);
        const bTitle = getPinyinSort(b.title);
        return bTitle.localeCompare(aTitle);
      });

    case 'artist-asc':
      return sorted.sort((a, b) => {
        const aArtist = getPinyinSort(a.artist || '');
        const bArtist = getPinyinSort(b.artist || '');
        return aArtist.localeCompare(bArtist);
      });

    case 'album-asc':
      return sorted.sort((a, b) => {
        const aAlbum = getPinyinSort(a.album || '');
        const bAlbum = getPinyinSort(b.album || '');
        return aAlbum.localeCompare(bAlbum);
      });

    case 'date-asc':
      return sorted.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    case 'date-desc':
    default:
      return sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

/**
 * Search songs across all or specific library
 */
export async function searchSongs(
  userId: string,
  query: string,
  libraryId?: string
) {
  const whereClause = {
    library: {
      userId,
      ...(libraryId ? { id: libraryId } : {}),
    },
    OR: query
      ? [
          { title: { contains: query, mode: 'insensitive' as const } },
          { artist: { contains: query, mode: 'insensitive' as const } },
          { album: { contains: query, mode: 'insensitive' as const } },
        ]
      : undefined,
  };

  return prisma.song.findMany({
    where: whereClause,
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
      coverUrl: true,
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
  });
}

/**
 * Find song by ID with ownership verification
 */
export async function findSongById(songId: string, userId: string) {
  return prisma.song.findFirst({
    where: {
      id: songId,
      library: {
        userId,
      },
    },
    include: {
      file: true,
      library: {
        select: { name: true },
      },
    },
  });
}

/**
 * Find song with file info for streaming
 */
export async function findSongForStreaming(songId: string, userId: string) {
  return prisma.song.findFirst({
    where: {
      id: songId,
      library: {
        userId,
      },
    },
    include: {
      file: true,
    },
  });
}

/**
 * Update song metadata
 */
export async function updateSong(songId: string, data: {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: number;
  genre?: string;
  trackNumber?: number;
  discNumber?: number;
  composer?: string;
}) {
  return prisma.song.update({
    where: { id: songId },
    data,
    include: {
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
  });
}

/**
 * Verify song exists in specific library
 */
export async function verifySongInLibrary(songId: string, libraryId: string, userId: string) {
  return prisma.song.findFirst({
    where: {
      id: songId,
      libraryId,
      library: {
        userId,
      },
    },
    include: {
      file: true,
    },
  });
}

/**
 * Count playlists containing a song
 */
export async function countPlaylistsWithSong(songId: string, userId: string) {
  return prisma.playlistSong.count({
    where: {
      songId,
      playlist: {
        userId,
      },
    },
  });
}

/**
 * Get all playlist IDs containing a song
 */
export async function getPlaylistsContainingSong(songId: string) {
  const playlistSongs = await prisma.playlistSong.findMany({
    where: { songId },
    select: { playlistId: true },
  });
  return playlistSongs.map(ps => ps.playlistId);
}

/**
 * Delete song and update counts
 */
export async function deleteSong(songId: string, libraryId: string, affectedPlaylistIds: string[]) {
  return prisma.$transaction([
    // Delete the song (cascade will delete PlaylistSong entries)
    prisma.song.delete({
      where: { id: songId },
    }),
    // Decrement library songCount
    prisma.library.update({
      where: { id: libraryId },
      data: { songCount: { decrement: 1 } },
    }),
    // Decrement songCount for all affected playlists
    ...affectedPlaylistIds.map(playlistId =>
      prisma.playlist.update({
        where: { id: playlistId },
        data: { songCount: { decrement: 1 } },
      })
    ),
  ]);
}

/**
 * Handle file cleanup after song deletion
 */
export async function cleanupFileAfterSongDeletion(fileId: string) {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
  });

  if (!file) return;

  const newRefCount = file.refCount - 1;
  
  if (newRefCount <= 0) {
    // Delete file record
    await prisma.file.delete({
      where: { id: fileId },
    });
    
    // TODO: Delete physical file from MinIO
    logger.info({ fileId, hash: file.hash }, 'File marked for deletion (refCount=0)');
  } else {
    // Just decrement the ref count
    await prisma.file.update({
      where: { id: fileId },
      data: { refCount: newRefCount },
    });
  }
}
