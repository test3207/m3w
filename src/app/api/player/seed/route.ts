import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/config';
import { logger } from '@/lib/logger';
import { getDefaultPlaybackSeed } from '@/lib/services/player.service';
import { ERROR_MESSAGES } from '@/locales/messages';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.unauthorized },
        { status: 401 }
      );
    }

    const seed = await getDefaultPlaybackSeed(session.user.id);

    if (!seed) {
      return NextResponse.json({
        success: true,
        data: null,
      });
    }

    // Use streaming API endpoint instead of presigned URL
    const audioUrl = `/api/songs/${seed.track.id}/stream`;

    return NextResponse.json({
      success: true,
      data: {
        track: {
          id: seed.track.id,
          title: seed.track.title,
          artist: seed.track.artist,
          album: seed.track.album,
          coverUrl: seed.track.coverUrl,
          duration: seed.track.file.duration ?? undefined,
          audioUrl,
          mimeType: seed.track.file.mimeType ?? undefined,
        },
        context: seed.context,
      },
    });
  } catch (error) {
    logger.error({
      msg: 'Failed to seed playback',
      error,
    });

    return NextResponse.json(
      { error: ERROR_MESSAGES.failedToSeedPlayback },
      { status: 500 }
    );
  }
}
