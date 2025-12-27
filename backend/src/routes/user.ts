/**
 * User Routes (Hono Backend)
 * User preferences management - online only
 */

import { Hono } from 'hono';
import { prisma } from '../lib/prisma';
import { createLogger } from '../lib/logger';
import { authMiddleware } from '../lib/auth-middleware';
import { updateUserPreferencesSchema } from '@m3w/shared';
import type { Context } from 'hono';
import type { ApiResponse, UserPreferences } from '@m3w/shared';
import { z } from 'zod';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

// GET /api/user/preferences - Get user preferences
app.get('/preferences', async (c: Context) => {
  const log = createLogger(c);
  try {
    const auth = c.get('auth');

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { cacheAllEnabled: true },
    });

    if (!user) {
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'User not found',
        },
        404
      );
    }

    const preferences: UserPreferences = {
      cacheAllEnabled: user.cacheAllEnabled,
    };

    return c.json<ApiResponse<UserPreferences>>({
      success: true,
      data: preferences,
    });
  } catch (error) {
    log.error({
      source: 'user.preferences.get',
      col1: 'user',
      col2: 'get',
      message: 'Failed to fetch user preferences',
      error,
    });
    return c.json<ApiResponse<never>>(
      {
        success: false,
        error: 'Failed to fetch user preferences',
      },
      500
    );
  }
});

// PUT /api/user/preferences - Update user preferences
app.put('/preferences', async (c: Context) => {
  const log = createLogger(c);
  try {
    const auth = c.get('auth');
    const body = await c.req.json();
    const data = updateUserPreferencesSchema.parse(body);

    const user = await prisma.user.update({
      where: { id: auth.userId },
      data: {
        ...(data.cacheAllEnabled !== undefined && { cacheAllEnabled: data.cacheAllEnabled }),
      },
      select: { cacheAllEnabled: true },
    });

    const preferences: UserPreferences = {
      cacheAllEnabled: user.cacheAllEnabled,
    };

    return c.json<ApiResponse<UserPreferences>>({
      success: true,
      data: preferences,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse<never>>(
        {
          success: false,
          error: 'Validation failed',
          details: error.issues,
        },
        400
      );
    }

    log.error({
      source: 'user.preferences.update',
      col1: 'user',
      col2: 'update',
      message: 'Failed to update user preferences',
      error,
    });
    return c.json<ApiResponse<never>>(
      {
        success: false,
        error: 'Failed to update user preferences',
      },
      500
    );
  }
});

export default app;
