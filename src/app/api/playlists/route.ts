import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { createPlaylist, getUserPlaylists } from '@/lib/services/playlist.service';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { ERROR_MESSAGES } from '@/locales/messages';
import { HttpStatusCode } from '@/lib/constants/http-status';

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
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: HttpStatusCode.UNAUTHORIZED });
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
      { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
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
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: HttpStatusCode.UNAUTHORIZED });
    }

    const body = await request.json();
    const validation = createPlaylistSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidInput, details: validation.error.issues },
        { status: HttpStatusCode.BAD_REQUEST }
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
      { status: HttpStatusCode.CREATED }
    );
  } catch (error) {
    logger.error({ msg: 'Failed to create playlist', error });
    return NextResponse.json(
      { error: ERROR_MESSAGES.failedToCreatePlaylist },
      { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
    );
  }
}
