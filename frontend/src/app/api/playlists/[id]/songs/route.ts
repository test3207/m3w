import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { addSongToPlaylist } from '@/lib/services/playlist.service';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { I18n } from '@/locales/i18n';
import { HttpStatusCode } from '@/lib/constants/http-status';

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
      return NextResponse.json({ error: I18n.error.unauthorized }, { status: HttpStatusCode.UNAUTHORIZED });
    }

    const { id } = await context.params;
    const body = await request.json();
    const validation = addSongSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: I18n.error.invalidInput, details: validation.error.issues },
        { status: HttpStatusCode.BAD_REQUEST }
      );
    }

    const relation = await addSongToPlaylist(id, validation.data.songId, session.user.id);

    if (!relation) {
      return NextResponse.json({ error: I18n.error.playlistNotFound }, { status: HttpStatusCode.NOT_FOUND });
    }

    return NextResponse.json({
      success: true,
      data: relation,
    });
  } catch (error) {
    logger.error({ msg: 'Failed to add song to playlist', error });
    return NextResponse.json(
      { error: I18n.error.failedToAddSongToPlaylist },
      { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
    );
  }
}
