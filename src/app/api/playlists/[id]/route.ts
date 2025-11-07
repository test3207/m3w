import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { deletePlaylist, getPlaylistById } from '@/lib/services/playlist.service';
import { logger } from '@/lib/logger';
import { ERROR_MESSAGES } from '@/locales/messages';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/playlists/[id]
 * Get a single playlist with songs
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: 401 });
    }

    const { id } = await context.params;
    const playlist = await getPlaylistById(id, session.user.id);

    if (!playlist) {
      return NextResponse.json({ error: ERROR_MESSAGES.playlistNotFound }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: playlist,
    });
  } catch (error) {
    logger.error({ msg: 'Failed to get playlist', error });
    return NextResponse.json(
      { error: ERROR_MESSAGES.failedToGetPlaylist },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/playlists/[id]
 * Delete a playlist owned by the current user
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: 401 });
    }

    const { id } = await context.params;
    const result = await deletePlaylist(id, session.user.id);

    if (!result) {
      return NextResponse.json({ error: ERROR_MESSAGES.playlistNotFound }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ msg: 'Failed to delete playlist', error });
    return NextResponse.json(
      { error: ERROR_MESSAGES.failedToDeletePlaylist },
      { status: 500 }
    );
  }
}
