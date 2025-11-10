import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Library } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { createLibraryFixture } from '@/test/fixtures/prisma';
import {
  createLibrary,
  getUserLibraries,
  getLibraryById,
  updateLibrary,
  deleteLibrary,
} from './library.service';

const { prismaLibraryMock } = vi.hoisted(() => {
  const library = {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  };

  return {
    prismaLibraryMock: library,
  };
});

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    library: prismaLibraryMock,
  },
}));

type LibraryWithCount = Library & { _count: { songs: number } };

const userId = 'user-1';

const baseLibrary = createLibraryFixture({
  id: 'lib-1',
  userId,
  name: 'My Library',
  description: 'Description',
});

describe('Library Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaLibraryMock.create.mockReset();
    prismaLibraryMock.findMany.mockReset();
    prismaLibraryMock.findUnique.mockReset();
    prismaLibraryMock.findFirst.mockReset();
    prismaLibraryMock.update.mockReset();
    prismaLibraryMock.delete.mockReset();
    prismaLibraryMock.count.mockReset();
  });

  describe('createLibrary', () => {
    it('creates library with provided name and description', async () => {
      prismaLibraryMock.create.mockResolvedValueOnce(baseLibrary);

      const result = await createLibrary(userId, 'My Library', 'Description');

      expect(prisma.library.create).toHaveBeenCalledWith({
        data: {
          userId,
          name: 'My Library',
          description: 'Description',
        },
      });
      expect(result).toEqual(baseLibrary);
    });

    it('allows optional description', async () => {
      prismaLibraryMock.create.mockResolvedValueOnce(
        createLibraryFixture({
          id: baseLibrary.id,
          userId,
          name: baseLibrary.name,
          description: null,
          createdAt: baseLibrary.createdAt,
          updatedAt: baseLibrary.updatedAt,
        })
      );

      const result = await createLibrary(userId, 'No Description');

      expect(prisma.library.create).toHaveBeenCalledWith({
        data: {
          userId,
          name: 'No Description',
        },
      });
    expect(result?.description).toBeNull();
    });
  });

  describe('getUserLibraries', () => {
    it('returns libraries with song counts', async () => {
      const libraryWithCount: LibraryWithCount = {
        ...baseLibrary,
        _count: { songs: 5 },
      };

      prismaLibraryMock.findMany.mockResolvedValueOnce([libraryWithCount]);

      const result = await getUserLibraries(userId);

      expect(prisma.library.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: {
          _count: {
            select: { songs: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(result).toEqual([libraryWithCount]);
    });

    it('returns empty array when no libraries found', async () => {
      prismaLibraryMock.findMany.mockResolvedValueOnce([]);

      const result = await getUserLibraries(userId);

      expect(result).toEqual([]);
    });
  });

  describe('getLibraryById', () => {
    it('returns library when owned by user', async () => {
      const libraryWithCount: LibraryWithCount = {
        ...baseLibrary,
        _count: { songs: 3 },
      };

      prismaLibraryMock.findFirst.mockResolvedValueOnce(libraryWithCount);

      const result = await getLibraryById(baseLibrary.id, userId);

      expect(prisma.library.findFirst).toHaveBeenCalledWith({
        where: { id: baseLibrary.id, userId },
        include: {
          _count: {
            select: { songs: true },
          },
        },
      });
      expect(result).toEqual(libraryWithCount);
    });

    it('throws when library not found', async () => {
      prismaLibraryMock.findFirst.mockResolvedValueOnce(null);

      const result = await getLibraryById('missing', userId);

      expect(result).toBeNull();
    });
  });

  describe('updateLibrary', () => {
    it('updates name and description for owned library', async () => {
      prismaLibraryMock.findFirst.mockResolvedValueOnce(baseLibrary);

      const updatedLibrary = {
        ...baseLibrary,
        name: 'Updated Name',
        description: 'New Description',
        updatedAt: new Date('2025-02-01T00:00:00.000Z'),
      } satisfies Library;

      prismaLibraryMock.update.mockResolvedValueOnce(updatedLibrary);

      const result = await updateLibrary(baseLibrary.id, userId, {
        name: 'Updated Name',
        description: 'New Description',
      });

      expect(prisma.library.update).toHaveBeenCalledWith({
        where: { id: baseLibrary.id },
        data: {
          name: 'Updated Name',
          description: 'New Description',
        },
      });
      expect(result).toEqual(updatedLibrary);
    });

    it('allows clearing description', async () => {
      prismaLibraryMock.findFirst.mockResolvedValueOnce(baseLibrary);

      const updatedLibrary = {
        ...baseLibrary,
        description: null,
      } satisfies Library;

      prismaLibraryMock.update.mockResolvedValueOnce(updatedLibrary);

      const result = await updateLibrary(baseLibrary.id, userId, {
        name: 'My Library',
        description: null,
      });

      expect(prisma.library.update).toHaveBeenCalledWith({
        where: { id: baseLibrary.id },
        data: {
          name: 'My Library',
          description: null,
        },
      });
    expect(result?.description).toBeNull();
    });

    it('returns null when library does not exist or not owned by user', async () => {
      prismaLibraryMock.findFirst.mockResolvedValueOnce(null);

      const result = await updateLibrary(baseLibrary.id, userId, {
        name: 'New',
        description: null,
      });

      expect(result).toBeNull();
      expect(prisma.library.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteLibrary', () => {
    it('deletes library when owned by user', async () => {
      prismaLibraryMock.findFirst.mockResolvedValueOnce({
        ...baseLibrary,
        songs: [{ id: 'song-1' }] as Array<{ id: string }>,
      } as Library & { songs: Array<{ id: string }> });

      prismaLibraryMock.delete.mockResolvedValueOnce(baseLibrary);

      const result = await deleteLibrary(baseLibrary.id, userId);

      expect(prisma.library.delete).toHaveBeenCalledWith({
        where: { id: baseLibrary.id },
      });
      expect(result).toEqual({ success: true, songsDeleted: 1 });
    });

    it('returns null when library does not exist or not owned by user', async () => {
      prismaLibraryMock.findFirst.mockResolvedValueOnce(null);

      const result = await deleteLibrary(baseLibrary.id, userId);

      expect(result).toBeNull();
      expect(prisma.library.delete).not.toHaveBeenCalled();
    });
  });
});
