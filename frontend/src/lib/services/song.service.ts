import type { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { logger } from '../logger';

interface SongMetadata {
  title: string;
  artist?: string | null;
  album?: string | null;
  albumArtist?: string | null;
  year?: number | null;
  genre?: string | null;
  trackNumber?: number | null;
  discNumber?: number | null;
  composer?: string | null;
}

interface CreateSongOptions {
  coverUrl?: string | null;
  rawMetadata?: Record<string, unknown> | null;
}

interface CreateSongParams {
  userId: string;
  libraryId: string;
  fileId: string;
  metadata: SongMetadata;
  options?: CreateSongOptions;
}

export async function createSong({
  userId,
  libraryId,
  fileId,
  metadata,
  options = {},
}: CreateSongParams) {
  try {
    const library = await prisma.library.findFirst({
      where: { id: libraryId, userId },
    });

    if (!library) {
      logger.warn({
        msg: 'Library not found for song creation',
        libraryId,
        userId,
      });
      return null;
    }

    const song = await prisma.song.create({
      data: {
        libraryId,
        fileId,
        title: metadata.title || 'Untitled Track',
        artist: metadata.artist ?? null,
        album: metadata.album ?? null,
        albumArtist: metadata.albumArtist ?? null,
        year: metadata.year ?? null,
        genre: metadata.genre ?? null,
        trackNumber: metadata.trackNumber ?? null,
        discNumber: metadata.discNumber ?? null,
        composer: metadata.composer ?? null,
        coverUrl: options.coverUrl ?? null,
        rawMetadata: options.rawMetadata
          ? (options.rawMetadata as Prisma.InputJsonValue)
          : undefined,
      },
      include: {
        file: true,
        library: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    logger.info({
      msg: 'Song created',
      songId: song.id,
      libraryId,
      userId,
    });

    return song;
  } catch (error) {
    logger.error({
      msg: 'Error creating song',
      libraryId,
      userId,
      fileId,
      error,
    });
    throw error;
  }
}

export async function getSongsByLibrary(
  libraryId: string,
  userId: string
) {
  try {
    const library = await prisma.library.findFirst({
      where: { id: libraryId, userId },
      select: { id: true },
    });

    if (!library) {
      logger.warn({
        msg: 'Library not found when listing songs',
        libraryId,
        userId,
      });
      return null;
    }

    const songs = await prisma.song.findMany({
      where: { libraryId },
      include: {
        file: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    logger.info({
      msg: 'Songs retrieved for library',
      libraryId,
      userId,
      count: songs.length,
    });

    return songs;
  } catch (error) {
    logger.error({
      msg: 'Error listing songs for library',
      libraryId,
      userId,
      error,
    });
    throw error;
  }
}
