import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { createPlaylist, getUserPlaylists } from '@/lib/services/playlist.service';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { ERROR_MESSAGES } from '@/locales/messages';

const createPlaylistSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  coverUrl: z.string().url().max(2048).optional(),
});

/**
 * GET /api/playlists
 * Get all playlists for the current user
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: 401 });
    }

    const playlists = await getUserPlaylists(session.user.id);

    return NextResponse.json({
      success: true,
      data: playlists,
    });
  } catch (error) {
    logger.error({ msg: 'Failed to get playlists', error });
    return NextResponse.json(
      { error: ERROR_MESSAGES.failedToGetPlaylists },
      { status: 500 }
    );
  }
}

/**
 * POST /api/playlists
 * Create a new playlist
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: 401 });
    }

    const body = await request.json();
    const validation = createPlaylistSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidInput, details: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, description, coverUrl } = validation.data;
    const playlist = await createPlaylist(session.user.id, name, {
      description,
      coverUrl,
    });

    return NextResponse.json(
      {
        success: true,
        data: playlist,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ msg: 'Failed to create playlist', error });
    return NextResponse.json(
      { error: ERROR_MESSAGES.failedToCreatePlaylist },
      { status: 500 }
    );
  }
}
