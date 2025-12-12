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
import { logger } from '../lib/logger';
import { authMiddleware } from '../lib/auth-middleware';
import {
  getPlaybackSeed,
  getPlaybackPreferences,
  updatePlaybackPreferences,
  getPlaybackProgress,
  updatePlaybackProgress,
} from '../lib/services/player.service';
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
    const seed = await getPlaybackSeed(auth.userId);

    return c.json({
      success: true,
      data: seed,
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
    const preferences = await getPlaybackPreferences(auth.userId);

    return c.json({
      success: true,
      data: preferences,
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
    const data = await updatePlaybackPreferences(auth.userId, parsed);

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
    const progress = await getPlaybackProgress(auth.userId);

    return c.json({
      success: true,
      data: progress,
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
    const success = await updatePlaybackProgress(auth.userId, parsed);

    if (!success) {
      return c.json(
        {
          success: false,
          error: 'Song not found',
        },
        404
      );
    }

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

export default app;
