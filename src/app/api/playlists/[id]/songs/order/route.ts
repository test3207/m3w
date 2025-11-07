import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { reorderPlaylistSongs } from '@/lib/services/playlist.service';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { ERROR_MESSAGES } from '@/locales/messages';

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
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: 401 });
    }

    const { id } = await context.params;
    const payload = await request.json();
    const validation = reorderSchema.safeParse(payload);

    if (!validation.success) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidInput, details: validation.error.issues },
        { status: 400 }
      );
    }

    const result = await reorderPlaylistSongs(id, session.user.id, validation.data.songIds);

    if (!result) {
      return NextResponse.json({ error: ERROR_MESSAGES.playlistNotFound }, { status: 404 });
    }

    if (!result.success) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidSongOrder, reason: result.reason },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ msg: 'Failed to reorder playlist songs', error });
    return NextResponse.json(
      { error: ERROR_MESSAGES.failedToReorderSongs },
      { status: 500 }
    );
  }
}
