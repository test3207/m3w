/**
 * Libraries Routes (Hono Backend)
 * User data routes - offline capable
 */

import { Hono } from 'hono';
import { z } from 'zod';
import pinyin from 'pinyin';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { authMiddleware } from '../lib/auth-middleware';
import { resolveCoverUrl } from '../lib/cover-url-helper';
import {
  createLibrarySchema,
  updateLibrarySchema,
  libraryIdSchema,
} from '@m3w/shared';
import type { Context } from 'hono';
import type { SongSortOption } from '@m3w/shared';
import type { Song, File } from '@prisma/client';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

// GET /api/libraries - List all libraries for current user
app.get('/', async (c: Context) => {
  try {
    const auth = c.get('auth');

    const libraries = await prisma.library.findMany({
      where: { userId: auth.userId },
      include: {
        _count: {
          select: { songs: true },
        },
        songs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, coverUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add coverUrl from last added song
    const librariesWithCover = libraries.map((lib) => {
      const lastSong = lib.songs[0];
      return {
        ...lib,
        coverUrl: lastSong ? resolveCoverUrl({ id: lastSong.id, coverUrl: lastSong.coverUrl }) : null,
        songs: undefined, // Remove songs array from response
      };
    });

    return c.json({
      success: true,
      data: librariesWithCover,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch libraries');
    return c.json(
      {
        success: false,
        error: 'Failed to fetch libraries',
      },
      500
    );
  }
});

// GET /api/libraries/:id - Get library by ID
app.get('/:id', async (c: Context) => {
  try {
    const { id } = libraryIdSchema.parse({ id: c.req.param('id') });
    const auth = c.get('auth');

    const library = await prisma.library.findFirst({
      where: { id, userId: auth.userId },
      include: {
        _count: {
          select: { songs: true },
        },
      },
    });

    if (!library) {
      return c.json(
        {
          success: false,
          error: 'Library not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: library,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: 'Invalid library ID',
          details: error.issues,
        },
        400
      );
    }

    logger.error(error, 'Failed to fetch library');
    return c.json(
      {
        success: false,
        error: 'Failed to fetch library',
      },
      500
    );
  }
});

// POST /api/libraries - Create new library
app.post('/', async (c: Context) => {
  try {
    const body = await c.req.json();
    const data = createLibrarySchema.parse(body);
    const auth = c.get('auth');

    const library = await prisma.library.create({
      data: {
        ...data,
        userId: auth.userId,
      },
      include: {
        _count: {
          select: { songs: true },
        },
      },
    });

    return c.json(
      {
        success: true,
        data: library,
        message: 'Library created successfully',
      },
      201
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to create library');
    return c.json(
      {
        success: false,
        error: 'Failed to create library',
      },
      500
    );
  }
});

// PATCH /api/libraries/:id - Update library
app.patch('/:id', async (c: Context) => {
  try {
    const { id } = libraryIdSchema.parse({ id: c.req.param('id') });
    const body = await c.req.json();
    const data = updateLibrarySchema.parse(body);
    const auth = c.get('auth');

    // Verify ownership
    const existing = await prisma.library.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!existing) {
      return c.json(
        {
          success: false,
          error: 'Library not found',
        },
        404
      );
    }

    const library = await prisma.library.update({
      where: { id },
      data,
      include: {
        _count: {
          select: { songs: true },
        },
      },
    });

    return c.json({
      success: true,
      data: library,
      message: 'Library updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to update library');
    return c.json(
      {
        success: false,
        error: 'Failed to update library',
      },
      500
    );
  }
});

// DELETE /api/libraries/:id - Delete library
app.delete('/:id', async (c: Context) => {
  try {
    const { id } = libraryIdSchema.parse({ id: c.req.param('id') });
    const auth = c.get('auth');

    // Verify ownership
    const existing = await prisma.library.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!existing) {
      return c.json(
        {
          success: false,
          error: 'Library not found',
        },
        404
      );
    }

    // Check if library can be deleted (protection for default library)
    if (!existing.canDelete) {
      return c.json(
        {
          success: false,
          message: '默认音乐库不能删除',
          error: 'CANNOT_DELETE_DEFAULT_LIBRARY',
        },
        403
      );
    }

    // Check if library has songs
    const songCount = await prisma.song.count({
      where: { libraryId: id },
    });

    if (songCount > 0) {
      return c.json(
        {
          success: false,
          error: 'Cannot delete library with songs',
        },
        400
      );
    }

    await prisma.library.delete({
      where: { id },
    });

    return c.json({
      success: true,
      message: 'Library deleted successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: 'Invalid library ID',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error }, 'Failed to delete library');
    return c.json(
      {
        success: false,
        error: 'Failed to delete library',
      },
      500
    );
  }
});

// Helper function to get Pinyin for sorting
function getPinyinSort(text: string): string {
  const pinyinArray = pinyin(text || '', { style: pinyin.STYLE_NORMAL });
  return pinyinArray.flat().join('').toLowerCase();
}

// Helper function to sort songs
type SongWithFile = Song & { file: File };

function sortSongs(songs: SongWithFile[], sortOption: SongSortOption): SongWithFile[] {
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
      return sorted.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    
    case 'date-desc':
    default:
      return sorted.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }
}

// GET /api/libraries/:id/songs - List songs in library
app.get('/:id/songs', async (c: Context) => {
  try {
    const { id } = libraryIdSchema.parse({ id: c.req.param('id') });
    const auth = c.get('auth');
    const sortParam = (c.req.query('sort') as SongSortOption) || 'date-desc';

    // Verify ownership
    const library = await prisma.library.findFirst({
      where: { id, userId: auth.userId },
    });

    if (!library) {
      return c.json(
        {
          success: false,
          error: 'Library not found',
        },
        404
      );
    }

    const songs = await prisma.song.findMany({
      where: { libraryId: id },
      include: {
        file: true,
      },
    });

    // Apply sorting
    const sortedSongs = sortSongs(songs, sortParam);

    // Convert coverUrl to API paths
    const songsWithResolvedCovers = sortedSongs.map(song => ({
      ...song,
      coverUrl: resolveCoverUrl({ id: song.id, coverUrl: song.coverUrl }),
    }));

    return c.json({
      success: true,
      data: songsWithResolvedCovers,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: 'Invalid library ID',
          details: error.issues,
        },
        400
      );
    }

    logger.error({ error, stack: error instanceof Error ? error.stack : undefined }, 'Failed to fetch library songs');
    return c.json(
      {
        success: false,
        error: 'Failed to fetch library songs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default app;
