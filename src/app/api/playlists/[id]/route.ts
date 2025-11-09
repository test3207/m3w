import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import {
  deletePlaylist,
  getPlaylistById,
  addSongToPlaylist,
  removeSongFromPlaylist,
  reorderPlaylistSongs,
} from '@/lib/services/playlist.service';
import { logger } from '@/lib/logger';
import { ERROR_MESSAGES } from '@/locales/messages';
import { HttpStatusCode } from '@/lib/constants/http-status';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/playlists/[id]
 * Get a single playlist with songs
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: HttpStatusCode.UNAUTHORIZED });
    }

    const { id } = await context.params;
    const playlist = await getPlaylistById(id, session.user.id);

    if (!playlist) {
      return NextResponse.json({ error: ERROR_MESSAGES.playlistNotFound }, { status: HttpStatusCode.NOT_FOUND });
    }

    return NextResponse.json({
      success: true,
      data: playlist,
    });
  } catch (error) {
    logger.error({ msg: 'Failed to get playlist', error });
    return NextResponse.json(
      { error: ERROR_MESSAGES.failedToGetPlaylist },
      { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
    );
  }
}

/**
 * DELETE /api/playlists/[id]
 * Delete a playlist owned by the current user
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: HttpStatusCode.UNAUTHORIZED });
    }

    const { id } = await context.params;
    const result = await deletePlaylist(id, session.user.id);

    if (!result) {
      return NextResponse.json({ error: ERROR_MESSAGES.playlistNotFound }, { status: HttpStatusCode.NOT_FOUND });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ msg: 'Failed to delete playlist', error });
    return NextResponse.json(
      { error: ERROR_MESSAGES.failedToDeletePlaylist },
      { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
    );
  }
}

/**
 * PATCH /api/playlists/[id]
 * Update playlist: add/remove/reorder songs
 * 
 * Body examples:
 * - Add song: { action: "add", songId: "..." }
 * - Remove song: { action: "remove", songId: "..." }
 * - Move song: { action: "move", songId: "...", direction: "up"|"down" }
 * - Reorder all: { action: "reorder", songIds: ["...", "..."] }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: HttpStatusCode.UNAUTHORIZED });
    }

    const { id: playlistId } = await context.params;
    const body = await request.json();
    const { action, songId, direction, songIds } = body;

    if (!action) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.missingActionParameter },
        { status: HttpStatusCode.BAD_REQUEST }
      );
    }

    // Add song to playlist
    if (action === 'add') {
      if (!songId) {
        return NextResponse.json(
          { error: ERROR_MESSAGES.missingSongId },
          { status: HttpStatusCode.BAD_REQUEST }
        );
      }

      const result = await addSongToPlaylist(playlistId, songId, session.user.id);
      if (!result) {
        return NextResponse.json(
          { error: ERROR_MESSAGES.unauthorizedOrNotFound },
          { status: HttpStatusCode.FORBIDDEN }
        );
      }

      return NextResponse.json({ success: true, data: result });
    }

    // Remove song from playlist
    if (action === 'remove') {
      if (!songId) {
        return NextResponse.json(
          { error: ERROR_MESSAGES.missingSongId },
          { status: HttpStatusCode.BAD_REQUEST }
        );
      }

      const result = await removeSongFromPlaylist(playlistId, songId, session.user.id);
      if (!result) {
        return NextResponse.json(
          { error: ERROR_MESSAGES.playlistNotFoundOrUnauthorized },
          { status: HttpStatusCode.NOT_FOUND }
        );
      }

      return NextResponse.json({ success: true });
    }

    // Move song up/down in playlist
    if (action === 'move') {
      if (!songId || !direction || !['up', 'down'].includes(direction)) {
        return NextResponse.json(
          { error: ERROR_MESSAGES.invalidSongIdOrDirection },
          { status: HttpStatusCode.BAD_REQUEST }
        );
      }

      const playlist = await getPlaylistById(playlistId, session.user.id);
      if (!playlist) {
        return NextResponse.json(
          { error: ERROR_MESSAGES.playlistNotFound },
          { status: HttpStatusCode.NOT_FOUND }
        );
      }

      const order = playlist.songs.map((entry) => entry.songId);
      const currentIndex = order.indexOf(songId);

      if (currentIndex === -1) {
        return NextResponse.json(
          { error: ERROR_MESSAGES.songNotFoundInPlaylist },
          { status: HttpStatusCode.NOT_FOUND }
        );
      }

      if (direction === 'up' && currentIndex > 0) {
        [order[currentIndex - 1], order[currentIndex]] = [order[currentIndex], order[currentIndex - 1]];
      } else if (direction === 'down' && currentIndex < order.length - 1) {
        [order[currentIndex], order[currentIndex + 1]] = [order[currentIndex + 1], order[currentIndex]];
      } else {
        return NextResponse.json(
          { error: ERROR_MESSAGES.invalidDirectionForPosition },
          { status: HttpStatusCode.BAD_REQUEST }
        );
      }

      const reorderResult = await reorderPlaylistSongs(playlistId, session.user.id, order);
      if (!reorderResult?.success) {
        return NextResponse.json(
          { error: ERROR_MESSAGES.failedToReorderSongs },
          { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
        );
      }

      return NextResponse.json({ success: true });
    }

    // Reorder all songs with explicit order
    if (action === 'reorder') {
      if (!Array.isArray(songIds)) {
        return NextResponse.json(
          { error: ERROR_MESSAGES.missingOrInvalidSongIds },
          { status: HttpStatusCode.BAD_REQUEST }
        );
      }

      const result = await reorderPlaylistSongs(playlistId, session.user.id, songIds);
      if (!result?.success) {
        return NextResponse.json(
          { error: result?.reason || ERROR_MESSAGES.failedToReorderSongs },
          { status: HttpStatusCode.BAD_REQUEST }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: `${ERROR_MESSAGES.unknownAction}: ${action}` },
      { status: HttpStatusCode.BAD_REQUEST }
    );
  } catch (error) {
    logger.error({ msg: 'Failed to update playlist', error });
    return NextResponse.json(
      { error: ERROR_MESSAGES.internalServerError },
      { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
    );
  }
}
