/**
 * Libraries Routes (Hono Backend)
 * User data routes - offline capable
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { authMiddleware } from '../lib/auth-middleware';
import {
  createLibrarySchema,
  updateLibrarySchema,
  libraryIdSchema,
} from '@m3w/shared';
import type { Context } from 'hono';

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
      },
      orderBy: { createdAt: 'desc' },
    });

    return c.json({
      success: true,
      data: libraries,
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

// GET /api/libraries/:id/songs - List songs in library
app.get('/:id/songs', async (c: Context) => {
  try {
    const { id } = libraryIdSchema.parse({ id: c.req.param('id') });
    const auth = c.get('auth');

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
      orderBy: { createdAt: 'desc' },
    });

    return c.json({
      success: true,
      data: songs,
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
