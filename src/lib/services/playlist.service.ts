import { prisma } from '../db/prisma';
import { logger } from '../logger';

interface CreatePlaylistOptions {
  description?: string | null;
  coverUrl?: string | null;
}

export async function createPlaylist(
  userId: string,
  name: string,
  options: CreatePlaylistOptions = {}
) {
  try {
    const playlist = await prisma.playlist.create({
      data: {
        userId,
        name,
        description: options.description,
        coverUrl: options.coverUrl,
      },
    });

    logger.info({ msg: 'Playlist created', playlistId: playlist.id, userId });

    return playlist;
  } catch (error) {
    logger.error({ msg: 'Error creating playlist', userId, error });
    throw error;
  }
}

export async function getUserPlaylists(userId: string) {
  try {
    const playlists = await prisma.playlist.findMany({
      where: { userId },
      include: {
        _count: {
          select: { songs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    logger.info({ msg: 'Playlists retrieved', userId, count: playlists.length });

    return playlists;
  } catch (error) {
    logger.error({ msg: 'Error getting playlists', userId, error });
    throw error;
  }
}

export async function getPlaylistById(playlistId: string, userId: string) {
  try {
    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId },
      include: {
        songs: {
          include: {
            song: {
              include: {
                file: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { songs: true },
        },
      },
    });

    if (!playlist) {
      logger.warn({ msg: 'Playlist not found', playlistId, userId });
      return null;
    }

    logger.info({ msg: 'Playlist retrieved', playlistId, userId });

    return playlist;
  } catch (error) {
    logger.error({ msg: 'Error getting playlist', playlistId, userId, error });
    throw error;
  }
}

export async function addSongToPlaylist(
  playlistId: string,
  songId: string,
  userId: string
) {
  try {
    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId },
    });

    if (!playlist) {
      logger.warn({ msg: 'Playlist not found for song add', playlistId, userId, songId });
      return null;
    }

    const existingSong = await prisma.playlistSong.findUnique({
      where: {
        playlistId_songId: {
          playlistId,
          songId,
        },
      },
    });

    if (existingSong) {
      logger.info({
        msg: 'Song already in playlist',
        playlistId,
        songId,
      });
      return existingSong;
    }

    const lastSong = await prisma.playlistSong.findFirst({
      where: { playlistId },
      orderBy: { order: 'desc' },
    });

    const nextOrder = lastSong ? lastSong.order + 1 : 0;

    const playlistSong = await prisma.playlistSong.create({
      data: {
        playlistId,
        songId,
        order: nextOrder,
      },
    });

    logger.info({
      msg: 'Song added to playlist',
      playlistId,
      songId,
      order: nextOrder,
    });

    return playlistSong;
  } catch (error) {
    logger.error({ msg: 'Error adding song to playlist', playlistId, userId, songId, error });
    throw error;
  }
}

export async function removeSongFromPlaylist(
  playlistId: string,
  songId: string,
  userId: string
) {
  try {
    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId },
    });

    if (!playlist) {
      logger.warn({ msg: 'Playlist not found for song removal', playlistId, userId, songId });
      return null;
    }

    const existingSong = await prisma.playlistSong.findUnique({
      where: {
        playlistId_songId: {
          playlistId,
          songId,
        },
      },
    });

    if (!existingSong) {
      logger.warn({
        msg: 'Song not found in playlist',
        playlistId,
        songId,
      });
      return null;
    }

    await prisma.playlistSong.delete({
      where: {
        playlistId_songId: {
          playlistId,
          songId,
        },
      },
    });

    logger.info({ msg: 'Song removed from playlist', playlistId, songId });

    return { success: true };
  } catch (error) {
    logger.error({ msg: 'Error removing song from playlist', playlistId, userId, songId, error });
    throw error;
  }
}

export async function deletePlaylist(playlistId: string, userId: string) {
  try {
    const existing = await prisma.playlist.findFirst({
      where: { id: playlistId, userId },
      include: { songs: true },
    });

    if (!existing) {
      logger.warn({ msg: 'Playlist not found for deletion', playlistId, userId });
      return null;
    }

    await prisma.playlist.delete({
      where: { id: playlistId },
    });

    logger.info({
      msg: 'Playlist deleted',
      playlistId,
      userId,
      songsRemoved: existing.songs.length,
    });

    return {
      success: true,
      songsRemoved: existing.songs.length,
    };
  } catch (error) {
    logger.error({ msg: 'Error deleting playlist', playlistId, userId, error });
    throw error;
  }
}

export async function reorderPlaylistSongs(
  playlistId: string,
  userId: string,
  songIds: string[]
) {
  try {
    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId },
      include: { songs: true },
    });

    if (!playlist) {
      logger.warn({ msg: 'Playlist not found for reordering', playlistId, userId });
      return null;
    }

    const currentSongIds = playlist.songs.map((song) => song.songId);
    const uniqueSongIds = Array.from(new Set(songIds));

    const hasDuplicates = uniqueSongIds.length !== songIds.length;
    const matchesCurrentSet =
      uniqueSongIds.length === currentSongIds.length &&
      uniqueSongIds.every((songId) => currentSongIds.includes(songId));

    if (hasDuplicates || !matchesCurrentSet) {
      logger.warn({
        msg: 'Invalid song order provided',
        playlistId,
        userId,
        providedCount: songIds.length,
        uniqueCount: uniqueSongIds.length,
        existingCount: currentSongIds.length,
      });
      return { success: false as const, reason: 'invalid-order' as const };
    }

    await Promise.all(
      uniqueSongIds.map((songId, index) =>
        prisma.playlistSong.update({
          where: {
            playlistId_songId: {
              playlistId,
              songId,
            },
          },
          data: { order: index },
        })
      )
    );

    logger.info({
      msg: 'Playlist reordered',
      playlistId,
      userId,
      songCount: uniqueSongIds.length,
    });

    return { success: true as const };
  } catch (error) {
    logger.error({ msg: 'Error reordering playlist songs', playlistId, userId, error });
    throw error;
  }
}
