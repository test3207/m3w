import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createSong, getSongsByLibrary } from './song.service';
import { prisma } from '@/lib/db/prisma';

const { prismaLibraryMock, prismaSongMock } = vi.hoisted(() => {
  const library = {
    findFirst: vi.fn(),
  };

  const song = {
    create: vi.fn(),
    findMany: vi.fn(),
  };

  return {
    prismaLibraryMock: library,
    prismaSongMock: song,
  };
});

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    library: prismaLibraryMock,
    song: prismaSongMock,
  },
}));

describe('Song Service', () => {
  const userId = 'user-1';
  const libraryId = 'library-1';
  const fileId = 'file-1';

  beforeEach(() => {
    vi.clearAllMocks();

    prismaLibraryMock.findFirst.mockReset();
    prismaSongMock.create.mockReset();
    prismaSongMock.findMany.mockReset();
  });

  describe('createSong', () => {
    it('creates song when library belongs to user', async () => {
      prismaLibraryMock.findFirst.mockResolvedValueOnce({ id: libraryId, userId });

      const createdSong = {
        id: 'song-1',
        title: 'My Song',
        artist: 'Artist',
        album: null,
        albumArtist: null,
        year: null,
        genre: null,
        trackNumber: null,
        discNumber: null,
        composer: null,
        coverUrl: null,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
        libraryId,
        fileId,
        rawMetadata: null,
        file: { id: fileId },
        library: { id: libraryId, name: 'My Library' },
      } as const;

      prismaSongMock.create.mockResolvedValueOnce(createdSong);

      const result = await createSong({
        userId,
        libraryId,
        fileId,
        metadata: {
          title: 'My Song',
          artist: 'Artist',
        },
        options: {
          coverUrl: null,
          rawMetadata: { title: 'My Song' },
        },
      });

      expect(prisma.library.findFirst).toHaveBeenCalledWith({
        where: { id: libraryId, userId },
      });
      expect(prisma.song.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          libraryId,
          fileId,
          title: 'My Song',
          artist: 'Artist',
        }),
        include: expect.any(Object),
      });
      expect(result).toEqual(createdSong);
    });

    it('returns null when library does not belong to user', async () => {
      prismaLibraryMock.findFirst.mockResolvedValueOnce(null);

      const result = await createSong({
        userId,
        libraryId,
        fileId,
        metadata: {
          title: 'Song',
        },
      });

      expect(result).toBeNull();
      expect(prisma.song.create).not.toHaveBeenCalled();
    });
  });

  describe('getSongsByLibrary', () => {
    it('returns songs when library belongs to user', async () => {
      prismaLibraryMock.findFirst.mockResolvedValueOnce({ id: libraryId });

      const songs = [
        {
          id: 'song-1',
          title: 'First',
          file: { id: fileId },
        },
      ];

      prismaSongMock.findMany.mockResolvedValueOnce(songs);

      const result = await getSongsByLibrary(libraryId, userId);

      expect(prisma.library.findFirst).toHaveBeenCalledWith({
        where: { id: libraryId, userId },
        select: { id: true },
      });
      expect(prisma.song.findMany).toHaveBeenCalledWith({
        where: { libraryId },
        include: { file: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(songs);
    });

    it('returns null when library is not found', async () => {
      prismaLibraryMock.findFirst.mockResolvedValueOnce(null);

      const result = await getSongsByLibrary(libraryId, userId);

      expect(result).toBeNull();
      expect(prisma.song.findMany).not.toHaveBeenCalled();
    });
  });
});
