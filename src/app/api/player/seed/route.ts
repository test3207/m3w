import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/config';
import { logger } from '@/lib/logger';
import { getDefaultPlaybackSeed } from '@/lib/services/player.service';
import { getPresignedUrl } from '@/lib/storage/minio-client';
import { ERROR_MESSAGES } from '@/locales/messages';

const DEFAULT_BUCKET = process.env.MINIO_BUCKET_NAME || 'm3w-audio';
const STREAM_EXPIRY_SECONDS = 60 * 60; // 1 hour

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

    const audioUrl = await getPresignedUrl(
      DEFAULT_BUCKET,
      seed.track.file.path,
      STREAM_EXPIRY_SECONDS
    );

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
