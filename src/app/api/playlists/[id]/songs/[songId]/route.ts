import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { removeSongFromPlaylist } from '@/lib/services/playlist.service';
import { logger } from '@/lib/logger';
import { ERROR_MESSAGES } from '@/locales/messages';

type RouteContext = {
  params: Promise<{ id: string; songId: string }>;
};

/**
 * DELETE /api/playlists/[id]/songs/[songId]
 * Remove a song from a playlist
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: 401 });
    }

    const { id, songId } = await context.params;
    const result = await removeSongFromPlaylist(id, songId, session.user.id);

    if (!result) {
      return NextResponse.json({ error: ERROR_MESSAGES.playlistOrSongNotFound }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ msg: 'Failed to remove song from playlist', error });
    return NextResponse.json(
      { error: ERROR_MESSAGES.failedToRemoveSongFromPlaylist },
      { status: 500 }
    );
  }
}
