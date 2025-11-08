import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { auth } from '@/lib/auth/config';
import { logger } from '@/lib/logger';
import {
  getPlaybackPreferences,
  updatePlaybackPreferences,
  playbackPreferenceUpdateSchema,
} from '@/lib/services/player.service';
import { ERROR_MESSAGES } from '@/locales/messages';
import { HttpStatusCode } from '@/lib/constants/http-status';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.unauthorized },
        { status: HttpStatusCode.UNAUTHORIZED }
      );
    }

    const preferences = await getPlaybackPreferences(session.user.id);

    return NextResponse.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    logger.error({
      msg: 'Failed to retrieve playback preferences via API',
      error,
    });

    return NextResponse.json(
      { error: ERROR_MESSAGES.failedToGetPlaybackPreferences },
      { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.unauthorized },
        { status: HttpStatusCode.UNAUTHORIZED }
      );
    }

    const body = await request.json();
    const parsed = playbackPreferenceUpdateSchema.parse(body);

    const preferences = await updatePlaybackPreferences(session.user.id, parsed);

    return NextResponse.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidInput },
        { status: HttpStatusCode.BAD_REQUEST }
      );
    }

    logger.error({
      msg: 'Failed to update playback preferences via API',
      error,
    });

    return NextResponse.json(
      { error: ERROR_MESSAGES.failedToUpdatePlaybackPreferences },
      { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
    );
  }
}
