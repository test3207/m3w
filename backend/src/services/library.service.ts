/**
 * Library Service
 * 
 * Encapsulates database operations for libraries.
 * Route handlers remain thin wrappers around these service methods.
 */

import { prisma } from '../lib/prisma';
import { createLogger } from '../lib/logger';
import { getPinyinSort } from '../lib/pinyin-helper';
import type { SongSortOption, LibraryInput, SongInput } from '@m3w/shared';

// Using a generic interface for sorting that works with Prisma results
interface SortableSong {
  title: string;
  artist: string | null;
  album: string | null;
  createdAt: Date;
}

/**
 * Sort songs by the given sort option
 */
export function sortSongs<T extends SortableSong>(songs: T[], sortOption: SongSortOption): T[] {
  const sorted = [...songs];
  
  switch (sortOption) {
    case 'title-asc':
      return sorted.sort((a, b) => {
        const aTitle = getPinyinSort(a.title);
        const bTitle = getPinyinSort(b.title);
        return aTitle.localeCompare(bTitle);
      });
    
    case 'title-desc':
      return sorted.sort((a, b) => {
        const aTitle = getPinyinSort(a.title);
        const bTitle = getPinyinSort(b.title);
        return bTitle.localeCompare(aTitle);
      });
    
    case 'artist-asc':
      return sorted.sort((a, b) => {
        const aArtist = getPinyinSort(a.artist || '');
        const bArtist = getPinyinSort(b.artist || '');
        return aArtist.localeCompare(bArtist);
      });
    
    case 'album-asc':
      return sorted.sort((a, b) => {
        const aAlbum = getPinyinSort(a.album || '');
        const bAlbum = getPinyinSort(b.album || '');
        return aAlbum.localeCompare(bAlbum);
      });
    
    case 'date-asc':
      return sorted.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    
    case 'date-desc':
    default:
      return sorted.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }
}

/**
 * Find all libraries for a user
 */
export async function findUserLibraries(userId: string): Promise<LibraryInput[]> {
  const libraries = await prisma.library.findMany({
    where: { userId },
    include: {
      songs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return libraries.map((lib) => {
    const lastSong = lib.songs[0];
    return {
      ...lib,
      coverSongId: lastSong?.id ?? null,
    };
  });
}

/**
 * Find a library by ID for a user
 */
export async function findLibraryById(libraryId: string, userId: string): Promise<LibraryInput | null> {
  const library = await prisma.library.findFirst({
    where: { id: libraryId, userId },
    include: {
      songs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!library) return null;

  const lastSong = library.songs[0];
  return {
    ...library,
    coverSongId: lastSong?.id ?? null,
  };
}

/**
 * Create a new library
 */
export async function createLibrary(
  userId: string,
  data: { name: string; description?: string | null }
): Promise<LibraryInput> {
  const library = await prisma.library.create({
    data: {
      ...data,
      userId,
      songCount: 0,
    },
  });

  return {
    ...library,
    coverSongId: null, // New library has no songs
  };
}

/**
 * Update a library
 */
export async function updateLibrary(
  libraryId: string,
  userId: string,
  data: { name?: string; description?: string | null }
): Promise<LibraryInput | null> {
  // Verify ownership
  const existing = await prisma.library.findFirst({
    where: { id: libraryId, userId },
  });

  if (!existing) return null;

  const library = await prisma.library.update({
    where: { id: libraryId },
    data,
    include: {
      songs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true },
      },
    },
  });

  const lastSong = library.songs[0];
  return {
    ...library,
    coverSongId: lastSong?.id ?? null,
  };
}

/**
 * Delete a library (validation should be done by caller)
 */
export async function deleteLibrary(libraryId: string, userId: string): Promise<{ deleted: boolean; error?: string }> {
  const existing = await prisma.library.findFirst({
    where: { id: libraryId, userId },
  });

  if (!existing) {
    return { deleted: false, error: 'Library not found' };
  }

  if (!existing.canDelete) {
    return { deleted: false, error: 'Cannot delete default library' };
  }

  if (existing.songCount > 0) {
    return { deleted: false, error: 'Cannot delete library with songs' };
  }

  await prisma.library.delete({
    where: { id: libraryId },
  });

  return { deleted: true };
}

/**
 * Get songs in a library with sorting
 */
export async function getLibrarySongs(
  libraryId: string,
  userId: string,
  sortOption: SongSortOption = 'date-desc'
): Promise<SongInput[] | null> {
  // Verify ownership
  const library = await prisma.library.findFirst({
    where: { id: libraryId, userId },
  });

  if (!library) return null;

  const songs = await prisma.song.findMany({
    where: { libraryId },
    include: {
      file: true,
      library: {
        select: { name: true },
      },
    },
  });

  const sortedSongs = sortSongs(songs, sortOption);

  return sortedSongs.map(song => ({
    ...song,
  }));
}

interface FileRecord {
  id: string;
  hash: string;
  path: string;
  size: number;
  mimeType: string;
  duration: number | null;
  bitrate: number | null;
  sampleRate: number | null;
  channels: number | null;
  refCount: number;
}

/**
 * Find or create a file record by hash
 */
export async function findOrCreateFileRecord(
  hash: string,
  fileData: {
    objectName: string;
    size: number;
    mimeType: string;
    metadata: {
      duration?: number;
      bitrate?: number;
      sampleRate?: number;
      channels?: number;
    };
  }
): Promise<{ fileRecord: FileRecord; isNewFile: boolean }> {
  let fileRecord = await prisma.file.findUnique({
    where: { hash },
  });

  if (fileRecord) {
    return { fileRecord, isNewFile: false };
  }

  fileRecord = await prisma.file.create({
    data: {
      hash,
      path: fileData.objectName,
      size: fileData.size,
      mimeType: fileData.mimeType,
      duration: fileData.metadata.duration ?? null,
      bitrate: fileData.metadata.bitrate ?? null,
      sampleRate: fileData.metadata.sampleRate ?? null,
      channels: fileData.metadata.channels ?? null,
      refCount: 0,
    },
  });

  const log = createLogger();
  log.info({
    source: 'library.service',
    col1: 'library',
    col2: 'create_file',
    col3: fileRecord.id,
    message: 'File record created',
  });
  return { fileRecord, isNewFile: true };
}

/**
 * Check if a song with the same file already exists in a library
 */
export async function checkExistingSongInLibrary(
  libraryId: string,
  fileId: string
): Promise<{ exists: boolean; song?: { id: string; title: string } }> {
  const existingSong = await prisma.song.findFirst({
    where: { libraryId, fileId },
    select: { id: true, title: true },
  });

  if (existingSong) {
    return { exists: true, song: existingSong };
  }

  return { exists: false };
}

interface SongMetadata {
  libraryId: string;
  title: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  composer?: string;
  coverUrl?: string;
  year?: number;
  trackNumber?: number;
  discNumber?: number;
}

/**
 * Create a song with file reference and update counts
 */
export async function createSongWithFileRef(
  fileId: string,
  metadata: SongMetadata
): Promise<SongInput> {
  const song = await prisma.$transaction(async (tx) => {
    // Create song
    const newSong = await tx.song.create({
      data: {
        ...metadata,
        fileId,
      },
      include: {
        file: true,
        library: {
          select: { name: true },
        },
      },
    });

    // Increment file refCount
    await tx.file.update({
      where: { id: fileId },
      data: { refCount: { increment: 1 } },
    });

    // Increment library songCount
    await tx.library.update({
      where: { id: metadata.libraryId },
      data: { songCount: { increment: 1 } },
    });

    return newSong;
  });

  const log = createLogger();
  log.info({
    source: 'library.service',
    col1: 'song',
    col2: 'create',
    col3: song.id,
    raw: { fileId },
    message: 'Song created',
  });

  return {
    ...song,
  };
}
