import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getSongsByLibrary } from '@/lib/services/song.service';
import { logger } from '@/lib/logger';
import { ERROR_MESSAGES } from '@/locales/messages';
import { HttpStatusCode } from '@/lib/constants/http-status';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/libraries/[id]/songs
 * Get all songs in a library
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.unauthorized },
        { status: HttpStatusCode.UNAUTHORIZED }
      );
    }

    const { id } = await context.params;
    const songs = await getSongsByLibrary(id, session.user.id);

    return NextResponse.json({
      success: true,
      data: songs,
    });
  } catch (error) {
    logger.error({ msg: 'Failed to get songs', error });
    return NextResponse.json(
      { error: ERROR_MESSAGES.failedToRetrieveSongs },
      { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
    );
  }
}
