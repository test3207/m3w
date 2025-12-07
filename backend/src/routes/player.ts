/**
 * Player Routes (Hono Backend)
 * Handles playback preferences and progress persistence
 * 
 * @related When modifying routes, sync these files:
 * - shared/src/api-contracts.ts - Route definitions and offline capability
 * - frontend/src/lib/offline-proxy/routes/player.ts - Offline proxy handlers
 * - frontend/src/services/api/main/endpoints.ts - Frontend endpoint definitions
 * - frontend/src/services/api/main/resources/player.ts - Frontend API methods
 */

import { Hono } from 'hono';
import { z, ZodError } from 'zod';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { authMiddleware } from '../lib/auth-middleware';
import { resolveCoverUrl } from '../lib/cover-url-helper';
import { RepeatMode } from '@m3w/shared';
import type { Context } from 'hono';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

// ============================================================================
// Schemas
// ============================================================================

const repeatModeValues = ['off', 'all', 'one'] as const;
const playbackContextValues = [
  'library',
  'playlist',
  'album',
  'search',
  'queue',
] as const;

const playbackPreferenceUpdateSchema = z
  .object({
    shuffleEnabled: z.boolean().optional(),
    repeatMode: z.enum(repeatModeValues).optional(),
  })
  .refine(
    (value) => value.shuffleEnabled !== undefined || value.repeatMode !== undefined,
    { message: 'At least one field must be provided.' }
  );

const playbackProgressUpdateSchema = z
  .object({
    songId: z.string().min(1),
    position: z.number().int().min(0).max(86_400),
    contextType: z.enum(playbackContextValues).optional(),
    contextId: z.string().min(1).optional(),
    contextName: z.string().min(1).optional(),
  })
  .refine(
    (value) =>
      (value.contextType && value.contextId) || (!value.contextType && !value.contextId),
    {
      message: 'contextId is required when contextType is provided.',
      path: ['contextId'],
    }
  );

// ============================================================================
// GET /api/player/seed - Get default playback seed
// ============================================================================

app.get('/seed', async (c: Context) => {
  try {
    const auth = c.get('auth');

    // Try to find first playlist with songs
    const playlist = await prisma.playlist.findFirst({
      where: {
        userId: auth.userId,
        songs: {
          some: {},
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        songs: {
          orderBy: {
            order: 'asc',
          },
          take: 1,
          include: {
            song: {
              select: {
                id: true,
                title: true,
                artist: true,
                album: true,
                coverUrl: true,
                file: {
                  select: {
                    duration: true,
                    mimeType: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const playlistSong = playlist?.songs[0]?.song;

    if (playlist && playlistSong) {
      // Use full backend URL for audio streaming
      const apiBaseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
      const audioUrl = `${apiBaseUrl}/api/songs/${playlistSong.id}/stream`;

      logger.debug(
        {
          playlistId: playlist.id,
          songId: playlistSong.id,
          userId: auth.userId,
        },
        'Resolved playback seed from playlist'
      );

      return c.json({
        success: true,
        data: {
          track: {
            id: playlistSong.id,
            title: playlistSong.title,
            artist: playlistSong.artist,
            album: playlistSong.album,
            coverUrl: resolveCoverUrl({ id: playlistSong.id, coverUrl: playlistSong.coverUrl }),
            duration: playlistSong.file.duration ?? undefined,
            audioUrl,
            mimeType: playlistSong.file.mimeType ?? undefined,
          },
          context: {
            type: 'playlist',
            id: playlist.id,
            name: playlist.name,
          },
        },
      });
    }

    // Fallback to first library with songs
    const library = await prisma.library.findFirst({
      where: {
        userId: auth.userId,
        songs: {
          some: {},
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        songs: {
          orderBy: {
            createdAt: 'asc',
          },
          take: 1,
          select: {
            id: true,
            title: true,
            artist: true,
            album: true,
            coverUrl: true,
            file: {
              select: {
                duration: true,
                mimeType: true,
              },
            },
          },
        },
      },
    });

    const librarySong = library?.songs[0];

    if (library && librarySong) {
      // Use full backend URL for audio streaming
      const apiBaseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
      const audioUrl = `${apiBaseUrl}/api/songs/${librarySong.id}/stream`;

      logger.debug(
        {
          libraryId: library.id,
          songId: librarySong.id,
          userId: auth.userId,
        },
        'Resolved playback seed from library'
      );

      return c.json({
        success: true,
        data: {
          track: {
            id: librarySong.id,
            title: librarySong.title,
            artist: librarySong.artist,
            album: librarySong.album,
            coverUrl: resolveCoverUrl({ id: librarySong.id, coverUrl: librarySong.coverUrl }),
            duration: librarySong.file.duration ?? undefined,
            audioUrl,
            mimeType: librarySong.file.mimeType ?? undefined,
          },
          context: {
            type: 'library',
            id: library.id,
            name: library.name,
          },
        },
      });
    }

    logger.debug({ userId: auth.userId }, 'No playback seed available for user');

    return c.json({
      success: true,
      data: null,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to seed playback');
    return c.json(
      {
        success: false,
        error: 'Failed to seed playback',
      },
      500
    );
  }
});

// ============================================================================
// GET /api/player/preferences - Get playback preferences
// ============================================================================

app.get('/preferences', async (c: Context) => {
  try {
    const auth = c.get('auth');

    const preference = await prisma.playbackPreference.findUnique({
      where: { userId: auth.userId },
    });

    const data = preference
      ? {
          shuffleEnabled: preference.shuffleEnabled,
          repeatMode: normalizeRepeatMode(preference.repeatMode),
        }
      : {
          shuffleEnabled: false,
          repeatMode: RepeatMode.Off,
        };

    return c.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to retrieve playback preferences');
    return c.json(
      {
        success: false,
        error: 'Failed to retrieve playback preferences',
      },
      500
    );
  }
});

// ============================================================================
// PUT /api/player/preferences - Update playback preferences
// ============================================================================

app.put('/preferences', async (c: Context) => {
  try {
    const auth = c.get('auth');
    const body = await c.req.json();

    const parsed = playbackPreferenceUpdateSchema.parse(body);

    const preference = await prisma.playbackPreference.upsert({
      where: { userId: auth.userId },
      create: {
        userId: auth.userId,
        shuffleEnabled: parsed.shuffleEnabled ?? false,
        repeatMode: parsed.repeatMode ?? 'off',
      },
      update: {
        ...(parsed.shuffleEnabled !== undefined
          ? { shuffleEnabled: parsed.shuffleEnabled }
          : {}),
        ...(parsed.repeatMode !== undefined
          ? { repeatMode: parsed.repeatMode }
          : {}),
      },
    });

    const data = {
      shuffleEnabled: preference.shuffleEnabled,
      repeatMode: normalizeRepeatMode(preference.repeatMode),
    };

    logger.debug(
      { userId: auth.userId, preferences: data },
      'Playback preferences updated'
    );

    return c.json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return c.json(
        {
          success: false,
          error: 'Invalid input',
        },
        400
      );
    }

    logger.error({ error }, 'Failed to update playback preferences');
    return c.json(
      {
        success: false,
        error: 'Failed to update playback preferences',
      },
      500
    );
  }
});

// ============================================================================
// GET /api/player/progress - Get playback progress
// ============================================================================

app.get('/progress', async (c: Context) => {
  try {
    const auth = c.get('auth');

    const progress = await prisma.playbackProgress.findUnique({
      where: { userId: auth.userId },
    });

    if (!progress) {
      return c.json({
        success: true,
        data: null,
      });
    }

    const song = await prisma.song.findFirst({
      where: {
        id: progress.songId,
        library: {
          userId: auth.userId,
        },
      },
      select: {
        id: true,
        title: true,
        artist: true,
        album: true,
        coverUrl: true,
        file: {
          select: {
            duration: true,
            mimeType: true,
          },
        },
      },
    });

    if (!song) {
      logger.warn(
        { userId: auth.userId, songId: progress.songId },
        'Playback progress refers to inaccessible song'
      );
      return c.json({
        success: true,
        data: null,
      });
    }

    // Use full backend URL for audio streaming
    const apiBaseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
    const audioUrl = `${apiBaseUrl}/api/songs/${song.id}/stream`;
    const context = mapPlaybackContext(
      progress.contextType,
      progress.contextId,
      progress.contextName
    );

    return c.json({
      success: true,
      data: {
        track: {
          id: song.id,
          title: song.title,
          artist: song.artist,
          album: song.album,
          coverUrl: resolveCoverUrl({ id: song.id, coverUrl: song.coverUrl }),
          duration: song.file.duration ?? undefined,
          audioUrl,
          mimeType: song.file.mimeType ?? undefined,
        },
        position: progress.position,
        context,
        updatedAt: progress.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to retrieve playback progress');
    return c.json(
      {
        success: false,
        error: 'Failed to retrieve playback progress',
      },
      500
    );
  }
});

// ============================================================================
// PUT /api/player/progress - Update playback progress
// ============================================================================

app.put('/progress', async (c: Context) => {
  try {
    const auth = c.get('auth');
    const body = await c.req.json();

    const parsed = playbackProgressUpdateSchema.parse(body);

    const song = await prisma.song.findFirst({
      where: {
        id: parsed.songId,
        library: {
          userId: auth.userId,
        },
      },
    });

    if (!song) {
      logger.warn(
        { userId: auth.userId, songId: parsed.songId },
        'Attempted to update progress for inaccessible song'
      );
      return c.json(
        {
          success: false,
          error: 'Song not found',
        },
        404
      );
    }

    await prisma.playbackProgress.upsert({
      where: { userId: auth.userId },
      create: {
        userId: auth.userId,
        songId: parsed.songId,
        position: parsed.position,
        contextType: parsed.contextType,
        contextId: parsed.contextId,
        contextName: parsed.contextName,
      },
      update: {
        songId: parsed.songId,
        position: parsed.position,
        contextType: parsed.contextType,
        contextId: parsed.contextId,
        contextName: parsed.contextName,
      },
    });

    logger.debug(
      {
        userId: auth.userId,
        songId: parsed.songId,
        position: parsed.position,
      },
      'Playback progress updated'
    );

    return c.json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return c.json(
        {
          success: false,
          error: 'Invalid input',
        },
        400
      );
    }

    logger.error({ error }, 'Failed to update playback progress');
    return c.json(
      {
        success: false,
        error: 'Failed to update playback progress',
      },
      500
    );
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeRepeatMode(value: string | null | undefined): RepeatMode {
  if (!value) return RepeatMode.Off;

  const candidate = value as RepeatMode;
  // Use Object.values to ensure validation stays in sync with enum changes
  return Object.values(RepeatMode).includes(candidate) ? candidate : RepeatMode.Off;
}

function mapPlaybackContext(
  type: string | null | undefined,
  id: string | null | undefined,
  name: string | null | undefined
) {
  if (!type || !id) return null;

  const validTypes = playbackContextValues as readonly string[];
  if (!validTypes.includes(type)) return null;

  return {
    type: type as 'library' | 'playlist' | 'album' | 'search' | 'queue',
    id,
    name: name ?? null,
  };
}

export default app;
