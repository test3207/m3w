import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import {
  createLibrary,
  getUserLibraries,
} from '@/lib/services/library.service';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { I18n } from '@/locales/i18n';
import { HttpStatusCode } from '@/lib/constants/http-status';

const createLibrarySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

/**
 * GET /api/libraries
 * Get all libraries for the current user
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: I18n.error.unauthorized }, { status: HttpStatusCode.UNAUTHORIZED });
    }

    const libraries = await getUserLibraries(session.user.id);

    return NextResponse.json({
      success: true,
      data: libraries,
    });
  } catch (error) {
    logger.error({ msg: 'Failed to get libraries', error });
    return NextResponse.json(
      { error: I18n.error.failedToRetrieveLibraries },
      { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
    );
  }
}

/**
 * POST /api/libraries
 * Create a new library
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: I18n.error.unauthorized }, { status: HttpStatusCode.UNAUTHORIZED });
    }

    const body = await request.json();
    const validation = createLibrarySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: I18n.error.invalidInput, details: validation.error.issues },
        { status: HttpStatusCode.BAD_REQUEST }
      );
    }

    const { name, description } = validation.data;
    const library = await createLibrary(session.user.id, name, description);

    return NextResponse.json(
      {
        success: true,
        data: library,
      },
      { status: HttpStatusCode.CREATED }
    );
  } catch (error) {
    logger.error({ msg: 'Failed to create library', error });
    return NextResponse.json(
      { error: I18n.error.failedToCreateLibrary },
      { status: HttpStatusCode.INTERNAL_SERVER_ERROR }
    );
  }
}
