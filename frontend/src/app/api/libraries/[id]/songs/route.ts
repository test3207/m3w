import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getSongsByLibrary } from '@/lib/services/song.service';
import { logger } from '@/lib/logger';
import { I18n } from '@/locales/i18n';
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
        { error: I18n.error.unauthorized },
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
      { error: I18n.error.failedToRetrieveSongs },
      { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
    );
  }
}
