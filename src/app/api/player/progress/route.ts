import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { auth } from '@/lib/auth/config';
import { logger } from '@/lib/logger';
import {
  getPlaybackProgress,
  updatePlaybackProgress,
  playbackProgressUpdateSchema,
} from '@/lib/services/player.service';
import { I18n } from '@/locales/i18n';
import { HttpStatusCode } from '@/lib/constants/http-status';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: I18n.error.unauthorized },
        { status: HttpStatusCode.UNAUTHORIZED }
      );
    }

    const progress = await getPlaybackProgress(session.user.id);

    if (!progress) {
      return NextResponse.json({
        success: true,
        data: null,
      });
    }

    // Use streaming API endpoint instead of presigned URL
    const audioUrl = `/api/songs/${progress.track.id}/stream`;

    return NextResponse.json({
      success: true,
      data: {
        track: {
          id: progress.track.id,
          title: progress.track.title,
          artist: progress.track.artist,
          album: progress.track.album,
          coverUrl: progress.track.coverUrl,
          duration: progress.track.file.duration ?? undefined,
          audioUrl,
          mimeType: progress.track.file.mimeType ?? undefined,
        },
        position: progress.position,
        context: progress.context,
        updatedAt: progress.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error({
      msg: 'Failed to retrieve playback progress via API',
      error,
    });

    return NextResponse.json(
      { error: I18n.error.failedToGetPlaybackProgress },
      { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: I18n.error.unauthorized },
        { status: HttpStatusCode.UNAUTHORIZED }
      );
    }

    const body = await request.json();
    const parsed = playbackProgressUpdateSchema.parse(body);

    await updatePlaybackProgress(session.user.id, parsed);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return NextResponse.json(
        { error: I18n.error.invalidInput },
        { status: HttpStatusCode.BAD_REQUEST }
      );
    }

    logger.error({
      msg: 'Failed to update playback progress via API',
      error,
    });

    return NextResponse.json(
      { error: I18n.error.failedToUpdatePlaybackProgress },
      { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
    );
  }
}
