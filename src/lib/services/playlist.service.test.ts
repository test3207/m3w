import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPlaylistFixture, createPlaylistSongFixture } from '@/test/fixtures/prisma';

import {
  addSongToPlaylist,
  createPlaylist,
  getPlaylistById,
  getUserPlaylists,
  deletePlaylist,
  removeSongFromPlaylist,
  reorderPlaylistSongs,
} from './playlist.service';
import { prisma } from '@/lib/db/prisma';

const {
  prismaPlaylistMock,
  prismaPlaylistSongMock,
} = vi.hoisted(() => {
  const playlist = {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
  };

  const playlistSong = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  };

  return {
    prismaPlaylistMock: playlist,
    prismaPlaylistSongMock: playlistSong,
  };
});

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    playlist: prismaPlaylistMock,
    playlistSong: prismaPlaylistSongMock,
  },
}));

describe('Playlist Service', () => {
  const userId = 'user-1';
  const playlistId = 'playlist-1';
  const songId = 'song-1';

  beforeEach(() => {
    vi.clearAllMocks();

    prismaPlaylistMock.create.mockReset();
    prismaPlaylistMock.findMany.mockReset();
    prismaPlaylistMock.findFirst.mockReset();
  prismaPlaylistMock.delete.mockReset();

    prismaPlaylistSongMock.findUnique.mockReset();
    prismaPlaylistSongMock.findFirst.mockReset();
    prismaPlaylistSongMock.create.mockReset();
    prismaPlaylistSongMock.delete.mockReset();
  prismaPlaylistSongMock.update.mockReset();
  });

  describe('createPlaylist', () => {
    it('creates playlist with provided name and options', async () => {
      const playlistFixture = createPlaylistFixture({
        id: playlistId,
        userId,
        name: 'Road Trip',
        description: 'Songs for long drives',
        coverUrl: 'cover.jpg',
      });

      prismaPlaylistMock.create.mockResolvedValueOnce(playlistFixture);

      const result = await createPlaylist(userId, 'Road Trip', {
        description: 'Songs for long drives',
        coverUrl: 'cover.jpg',
      });

      expect(prisma.playlist.create).toHaveBeenCalledWith({
        data: {
          userId,
          name: 'Road Trip',
          description: 'Songs for long drives',
          coverUrl: 'cover.jpg',
        },
      });
      expect(result).toEqual(playlistFixture);
    });
  });

  describe('getUserPlaylists', () => {
    it('returns playlists with song counts', async () => {
      const playlistWithCount = {
        ...createPlaylistFixture({ id: playlistId, userId }),
        _count: { songs: 3 },
      };

      prismaPlaylistMock.findMany.mockResolvedValueOnce([playlistWithCount]);

      const result = await getUserPlaylists(userId);

      expect(prisma.playlist.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: {
          _count: {
            select: { songs: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([playlistWithCount]);
    });
  });

  describe('getPlaylistById', () => {
    it('returns playlist with songs when owned by user', async () => {
      const playlistWithSongs = {
        ...createPlaylistFixture({ id: playlistId, userId }),
        songs: [
          {
            ...createPlaylistSongFixture({ playlistId, songId, order: 0 }),
            song: {
              id: songId,
              title: 'Song Title',
              file: { id: 'file-1', duration: 215 },
            },
          },
        ],
        _count: { songs: 1 },
      };

      prismaPlaylistMock.findFirst.mockResolvedValueOnce(playlistWithSongs);

      const result = await getPlaylistById(playlistId, userId);

      expect(prisma.playlist.findFirst).toHaveBeenCalledWith({
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
      expect(result).toEqual(playlistWithSongs);
    });

    it('returns null when playlist not found', async () => {
      prismaPlaylistMock.findFirst.mockResolvedValueOnce(null);

      const result = await getPlaylistById('missing', userId);

      expect(result).toBeNull();
    });
  });

  describe('addSongToPlaylist', () => {
    it('adds new song with incremented order', async () => {
      prismaPlaylistMock.findFirst.mockResolvedValueOnce(
        createPlaylistFixture({ id: playlistId, userId })
      );
      prismaPlaylistSongMock.findUnique.mockResolvedValueOnce(null);
      prismaPlaylistSongMock.findFirst.mockResolvedValueOnce(
        createPlaylistSongFixture({ playlistId, songId: 'existing-song', order: 4 })
      );
      prismaPlaylistSongMock.create.mockResolvedValueOnce(
        createPlaylistSongFixture({ playlistId, songId, order: 5 })
      );

      const result = await addSongToPlaylist(playlistId, songId, userId);

      expect(prisma.playlistSong.create).toHaveBeenCalledWith({
        data: {
          playlistId,
          songId,
          order: 5,
        },
      });
      expect(result?.order).toBe(5);
    });

    it('returns existing song when already in playlist', async () => {
      const existingRelation = createPlaylistSongFixture({ playlistId, songId, order: 0 });
      prismaPlaylistMock.findFirst.mockResolvedValueOnce(
        createPlaylistFixture({ id: playlistId, userId })
      );
      prismaPlaylistSongMock.findUnique.mockResolvedValueOnce(existingRelation);

      const result = await addSongToPlaylist(playlistId, songId, userId);

      expect(prisma.playlistSong.create).not.toHaveBeenCalled();
      expect(result).toEqual(existingRelation);
    });

    it('returns null when playlist is not owned by user', async () => {
      prismaPlaylistMock.findFirst.mockResolvedValueOnce(null);

      const result = await addSongToPlaylist('other-playlist', songId, userId);

      expect(result).toBeNull();
      expect(prisma.playlistSong.create).not.toHaveBeenCalled();
    });
  });

  describe('removeSongFromPlaylist', () => {
    it('removes song when playlist is owned by user', async () => {
      prismaPlaylistMock.findFirst.mockResolvedValueOnce(
        createPlaylistFixture({ id: playlistId, userId })
      );
      prismaPlaylistSongMock.findUnique.mockResolvedValueOnce(
        createPlaylistSongFixture({ playlistId, songId, order: 0 })
      );
      prismaPlaylistSongMock.delete.mockResolvedValueOnce({});

      const result = await removeSongFromPlaylist(playlistId, songId, userId);

      expect(prisma.playlistSong.delete).toHaveBeenCalledWith({
        where: {
          playlistId_songId: {
            playlistId,
            songId,
          },
        },
      });
      expect(result).toEqual({ success: true });
    });

    it('returns null when playlist not found', async () => {
      prismaPlaylistMock.findFirst.mockResolvedValueOnce(null);

      const result = await removeSongFromPlaylist('missing', songId, userId);

      expect(result).toBeNull();
      expect(prisma.playlistSong.delete).not.toHaveBeenCalled();
    });

    it('returns null when song not in playlist', async () => {
      prismaPlaylistMock.findFirst.mockResolvedValueOnce(
        createPlaylistFixture({ id: playlistId, userId })
      );
      prismaPlaylistSongMock.findUnique.mockResolvedValueOnce(null);

      const result = await removeSongFromPlaylist(playlistId, songId, userId);

      expect(result).toBeNull();
      expect(prisma.playlistSong.delete).not.toHaveBeenCalled();
    });
  });

  describe('deletePlaylist', () => {
    it('deletes playlist when owned by user', async () => {
      const playlistWithSongs = {
        ...createPlaylistFixture({ id: playlistId, userId }),
        songs: [
          createPlaylistSongFixture({ playlistId, songId: 'song-1', order: 0 }),
          createPlaylistSongFixture({ playlistId, songId: 'song-2', order: 1 }),
        ],
      } as const;

      prismaPlaylistMock.findFirst.mockResolvedValueOnce(playlistWithSongs);
      prismaPlaylistMock.delete.mockResolvedValueOnce({});

      const result = await deletePlaylist(playlistId, userId);

      expect(prisma.playlist.delete).toHaveBeenCalledWith({
        where: { id: playlistId },
      });
      expect(result).toEqual({ success: true, songsRemoved: 2 });
    });

    it('returns null when playlist does not exist or not owned by user', async () => {
      prismaPlaylistMock.findFirst.mockResolvedValueOnce(null);

      const result = await deletePlaylist('missing', userId);

      expect(result).toBeNull();
      expect(prisma.playlist.delete).not.toHaveBeenCalled();
    });
  });

  describe('reorderPlaylistSongs', () => {
    it('reorders songs when playlist is owned by user', async () => {
      prismaPlaylistMock.findFirst.mockResolvedValueOnce({
        ...createPlaylistFixture({ id: playlistId, userId }),
        songs: [
          createPlaylistSongFixture({ playlistId, songId: 'song-1', order: 0 }),
          createPlaylistSongFixture({ playlistId, songId: 'song-2', order: 1 }),
          createPlaylistSongFixture({ playlistId, songId: 'song-3', order: 2 }),
        ],
      });

      prismaPlaylistSongMock.update.mockResolvedValue({});

      const result = await reorderPlaylistSongs(playlistId, userId, [
        'song-3',
        'song-1',
        'song-2',
      ]);

      expect(prisma.playlistSong.update).toHaveBeenNthCalledWith(1, {
        where: {
          playlistId_songId: {
            playlistId,
            songId: 'song-3',
          },
        },
        data: { order: 0 },
      });
      expect(prisma.playlistSong.update).toHaveBeenNthCalledWith(2, {
        where: {
          playlistId_songId: {
            playlistId,
            songId: 'song-1',
          },
        },
        data: { order: 1 },
      });
      expect(prisma.playlistSong.update).toHaveBeenNthCalledWith(3, {
        where: {
          playlistId_songId: {
            playlistId,
            songId: 'song-2',
          },
        },
        data: { order: 2 },
      });
      expect(result).toEqual({ success: true });
    });

    it('returns invalid-order reason when payload does not match current songs', async () => {
      prismaPlaylistMock.findFirst.mockResolvedValueOnce({
        ...createPlaylistFixture({ id: playlistId, userId }),
        songs: [createPlaylistSongFixture({ playlistId, songId: 'song-1', order: 0 })],
      });

      const result = await reorderPlaylistSongs(playlistId, userId, ['song-1', 'song-2']);

      expect(result).toEqual({ success: false, reason: 'invalid-order' });
      expect(prisma.playlistSong.update).not.toHaveBeenCalled();
    });

    it('returns null when playlist not found', async () => {
      prismaPlaylistMock.findFirst.mockResolvedValueOnce(null);

      const result = await reorderPlaylistSongs('missing', userId, ['song-1']);

      expect(result).toBeNull();
      expect(prisma.playlistSong.update).not.toHaveBeenCalled();
    });
  });
});
