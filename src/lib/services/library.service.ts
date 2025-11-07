import { prisma } from '../db/prisma';
import { logger } from '../logger';

/**
 * Create a new library
 */
export async function createLibrary(
  userId: string,
  name: string,
  description?: string | null
) {
  try {
    const library = await prisma.library.create({
      data: {
        name,
        description,
        userId,
      },
    });

    logger.info({ msg: 'Library created', libraryId: library.id, userId });

    return library;
  } catch (error) {
    logger.error({ msg: 'Error creating library', userId, error });
    throw error;
  }
}

/**
 * Get all libraries for a user
 */
export async function getUserLibraries(userId: string) {
  try {
    const libraries = await prisma.library.findMany({
      where: { userId },
      include: {
        _count: {
          select: { songs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    logger.info({ msg: 'Libraries retrieved', userId, count: libraries.length });

    return libraries;
  } catch (error) {
    logger.error({ msg: 'Error getting libraries', userId, error });
    throw error;
  }
}

/**
 * Get a single library by ID
 */
export async function getLibraryById(libraryId: string, userId: string) {
  try {
    const library = await prisma.library.findFirst({
      where: {
        id: libraryId,
        userId,
      },
      include: {
        _count: {
          select: { songs: true },
        },
      },
    });

    if (!library) {
      logger.warn({ msg: 'Library not found', libraryId, userId });
      return null;
    }

    logger.info({ msg: 'Library retrieved', libraryId, userId });

    return library;
  } catch (error) {
    logger.error({ msg: 'Error getting library', libraryId, userId, error });
    throw error;
  }
}

/**
 * Update a library
 */
export async function updateLibrary(
  libraryId: string,
  userId: string,
  data: { name?: string; description?: string | null }
) {
  try {
    // Check ownership
    const existing = await prisma.library.findFirst({
      where: { id: libraryId, userId },
    });

    if (!existing) {
      logger.warn({ msg: 'Library not found for update', libraryId, userId });
      return null;
    }

    const library = await prisma.library.update({
      where: { id: libraryId },
      data,
    });

    logger.info({ msg: 'Library updated', libraryId, userId });

    return library;
  } catch (error) {
    logger.error({ msg: 'Error updating library', libraryId, userId, error });
    throw error;
  }
}

/**
 * Delete a library and all its songs
 */
export async function deleteLibrary(libraryId: string, userId: string) {
  try {
    // Check ownership
    const existing = await prisma.library.findFirst({
      where: { id: libraryId, userId },
      include: { songs: true },
    });

    if (!existing) {
      logger.warn({ msg: 'Library not found for deletion', libraryId, userId });
      return null;
    }

    // Delete library (cascade will delete songs)
    // Song deletion will trigger file reference decrement in application logic
    await prisma.library.delete({
      where: { id: libraryId },
    });

    logger.info({
      msg: 'Library deleted',
      libraryId,
      userId,
      songsDeleted: existing.songs.length,
    });

    return { success: true, songsDeleted: existing.songs.length };
  } catch (error) {
    logger.error({ msg: 'Error deleting library', libraryId, userId, error });
    throw error;
  }
}
