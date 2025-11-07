import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import {
  getLibraryById,
  updateLibrary,
  deleteLibrary,
} from '@/lib/services/library.service';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { ERROR_MESSAGES } from '@/locales/messages';

const updateLibrarySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/libraries/[id]
 * Get a single library
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: 401 });
    }

    const { id } = await context.params;
    const library = await getLibraryById(id, session.user.id);

    if (!library) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.libraryNotFound },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: library,
    });
  } catch (error) {
    logger.error({ msg: 'Failed to get library', error });
    return NextResponse.json(
      { error: ERROR_MESSAGES.failedToRetrieveLibrary },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/libraries/[id]
 * Update a library
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const validation = updateLibrarySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.invalidInput, details: validation.error.issues },
        { status: 400 }
      );
    }

    const library = await updateLibrary(id, session.user.id, validation.data);

    if (!library) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.libraryNotFound },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: library,
    });
  } catch (error) {
    logger.error({ msg: 'Failed to update library', error });
    return NextResponse.json(
      { error: ERROR_MESSAGES.failedToUpdateLibrary },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/libraries/[id]
 * Delete a library
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: ERROR_MESSAGES.unauthorized }, { status: 401 });
    }

    const { id } = await context.params;
    const result = await deleteLibrary(id, session.user.id);

    if (!result) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.libraryNotFound },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ msg: 'Failed to delete library', error });
    return NextResponse.json(
      { error: ERROR_MESSAGES.failedToDeleteLibrary },
      { status: 500 }
    );
  }
}
