import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { reorderPlaylistSongs } from '@/lib/services/playlist.service';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { ERROR_MESSAGES } from '@/locales/messages';
import { HttpStatusCode } from '@/lib/constants/http-status';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const reorderSchema = z.object({
  songIds: z.array(z.string().min(1)).min(1),
});

/**
 * PATCH /api/playlists/[id]/songs/order
 * Reorder songs within a playlist
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: HttpStatusCode.UNAUTHORIZED });
    }

    const { id } = await context.params;
    const payload = await request.json();
    const validation = reorderSchema.safeParse(payload);

    if (!validation.success) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidInput, details: validation.error.issues },
        { status: HttpStatusCode.BAD_REQUEST }
      );
    }

    const result = await reorderPlaylistSongs(id, session.user.id, validation.data.songIds);

    if (!result) {
      return NextResponse.json({ error: ERROR_MESSAGES.playlistNotFound }, { status: HttpStatusCode.NOT_FOUND });
    }

    if (!result.success) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidSongOrder, reason: result.reason },
        { status: HttpStatusCode.BAD_REQUEST }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ msg: 'Failed to reorder playlist songs', error });
    return NextResponse.json(
      { error: ERROR_MESSAGES.failedToReorderSongs },
      { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
    );
  }
}
