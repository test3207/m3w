import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { removeSongFromPlaylist } from '@/lib/services/playlist.service';
import { logger } from '@/lib/logger';
import { I18n } from '@/locales/i18n';
import { HttpStatusCode } from '@/lib/constants/http-status';

type RouteContext = {
  params: Promise<{ id: string; songId: string }>;
};

/**
 * DELETE /api/playlists/[id]/songs/[songId]
 * Remove a song from a playlist
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: I18n.error.unauthorized }, { status: HttpStatusCode.UNAUTHORIZED });
    }

    const { id, songId } = await context.params;
    const result = await removeSongFromPlaylist(id, songId, session.user.id);

    if (!result) {
      return NextResponse.json({ error: I18n.error.playlistOrSongNotFound }, { status: HttpStatusCode.NOT_FOUND });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ msg: 'Failed to remove song from playlist', error });
    return NextResponse.json(
      { error: I18n.error.failedToRemoveSongFromPlaylist },
      { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
    );
  }
}
