import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { addSongToPlaylist } from '@/lib/services/playlist.service';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { ERROR_MESSAGES } from '@/locales/messages';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const addSongSchema = z.object({
  songId: z.string().min(1),
});

/**
 * POST /api/playlists/[id]/songs
 * Add a song to a playlist
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const validation = addSongSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidInput, details: validation.error.issues },
        { status: 400 }
      );
    }

    const relation = await addSongToPlaylist(id, validation.data.songId, session.user.id);

    if (!relation) {
      return NextResponse.json({ error: ERROR_MESSAGES.playlistNotFound }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: relation,
    });
  } catch (error) {
    logger.error({ msg: 'Failed to add song to playlist', error });
    return NextResponse.json(
      { error: ERROR_MESSAGES.failedToAddSongToPlaylist },
      { status: 500 }
    );
  }
}
