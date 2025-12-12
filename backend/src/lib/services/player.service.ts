/**
 * Player Service
 *
 * Business logic for playback preferences and progress persistence.
 * Database operations for player-related entities.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { resolveCoverUrl } from '../cover-url-helper';
import { RepeatMode } from '@m3w/shared';

// ============================================================================
// Types
// ============================================================================

export interface TrackResponse {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  coverUrl: string | null;
  duration?: number;
  audioUrl: string;
  mimeType?: string;
}

export interface PlaybackContext {
  type: 'library' | 'playlist' | 'album' | 'search' | 'queue';
  id: string;
  name: string | null;
}

export interface PlaybackSeedResponse {
  track: TrackResponse;
  context: PlaybackContext;
}

export interface PlaybackPreferences {
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
}

export interface PlaybackProgressResponse {
  track: TrackResponse;
  position: number;
  context: PlaybackContext | null;
  updatedAt: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getApiBaseUrl(): string {
  return process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
}

function buildAudioUrl(songId: string): string {
  return `${getApiBaseUrl()}/api/songs/${songId}/stream`;
}

export function normalizeRepeatMode(value: string | null | undefined): RepeatMode {
  if (!value) return RepeatMode.Off;
  const candidate = value as RepeatMode;
  return Object.values(RepeatMode).includes(candidate) ? candidate : RepeatMode.Off;
}

const playbackContextValues = [
  'library',
  'playlist',
  'album',
  'search',
  'queue',
] as const;

export function mapPlaybackContext(
  type: string | null | undefined,
  id: string | null | undefined,
  name: string | null | undefined
): PlaybackContext | null {
  if (!type || !id) return null;

  const validTypes = playbackContextValues as readonly string[];
  if (!validTypes.includes(type)) return null;

  return {
    type: type as PlaybackContext['type'],
    id,
    name: name ?? null,
  };
}

// ============================================================================
// Seed Operations
// ============================================================================

/**
 * Get playback seed (first song from playlist or library)
 */
export async function getPlaybackSeed(userId: string): Promise<PlaybackSeedResponse | null> {
  // Try to find first playlist with songs
  const playlist = await prisma.playlist.findFirst({
    where: {
      userId,
      songs: { some: {} },
    },
    orderBy: { createdAt: 'asc' },
    include: {
      songs: {
        orderBy: { order: 'asc' },
        take: 1,
        include: {
          song: {
            select: {
              id: true,
              title: true,
              artist: true,
              album: true,
              coverUrl: true,
              file: {
                select: {
                  duration: true,
                  mimeType: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const playlistSong = playlist?.songs[0]?.song;

  if (playlist && playlistSong) {
    logger.debug(
      { playlistId: playlist.id, songId: playlistSong.id, userId },
      'Resolved playback seed from playlist'
    );

    return {
      track: {
        id: playlistSong.id,
        title: playlistSong.title,
        artist: playlistSong.artist,
        album: playlistSong.album,
        coverUrl: resolveCoverUrl({ id: playlistSong.id, coverUrl: playlistSong.coverUrl }),
        duration: playlistSong.file.duration ?? undefined,
        audioUrl: buildAudioUrl(playlistSong.id),
        mimeType: playlistSong.file.mimeType ?? undefined,
      },
      context: {
        type: 'playlist',
        id: playlist.id,
        name: playlist.name,
      },
    };
  }

  // Fallback to first library with songs
  const library = await prisma.library.findFirst({
    where: {
      userId,
      songs: { some: {} },
    },
    orderBy: { createdAt: 'asc' },
    include: {
      songs: {
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: {
          id: true,
          title: true,
          artist: true,
          album: true,
          coverUrl: true,
          file: {
            select: {
              duration: true,
              mimeType: true,
            },
          },
        },
      },
    },
  });

  const librarySong = library?.songs[0];

  if (library && librarySong) {
    logger.debug(
      { libraryId: library.id, songId: librarySong.id, userId },
      'Resolved playback seed from library'
    );

    return {
      track: {
        id: librarySong.id,
        title: librarySong.title,
        artist: librarySong.artist,
        album: librarySong.album,
        coverUrl: resolveCoverUrl({ id: librarySong.id, coverUrl: librarySong.coverUrl }),
        duration: librarySong.file.duration ?? undefined,
        audioUrl: buildAudioUrl(librarySong.id),
        mimeType: librarySong.file.mimeType ?? undefined,
      },
      context: {
        type: 'library',
        id: library.id,
        name: library.name,
      },
    };
  }

  logger.debug({ userId }, 'No playback seed available for user');
  return null;
}

// ============================================================================
// Preferences Operations
// ============================================================================

/**
 * Get playback preferences for user
 */
export async function getPlaybackPreferences(userId: string): Promise<PlaybackPreferences> {
  const preference = await prisma.playbackPreference.findUnique({
    where: { userId },
  });

  return preference
    ? {
        shuffleEnabled: preference.shuffleEnabled,
        repeatMode: normalizeRepeatMode(preference.repeatMode),
      }
    : {
        shuffleEnabled: false,
        repeatMode: RepeatMode.Off,
      };
}

/**
 * Update playback preferences
 */
export async function updatePlaybackPreferences(
  userId: string,
  updates: { shuffleEnabled?: boolean; repeatMode?: string }
): Promise<PlaybackPreferences> {
  const preference = await prisma.playbackPreference.upsert({
    where: { userId },
    create: {
      userId,
      shuffleEnabled: updates.shuffleEnabled ?? false,
      repeatMode: updates.repeatMode ?? 'off',
    },
    update: {
      ...(updates.shuffleEnabled !== undefined ? { shuffleEnabled: updates.shuffleEnabled } : {}),
      ...(updates.repeatMode !== undefined ? { repeatMode: updates.repeatMode } : {}),
    },
  });

  const data = {
    shuffleEnabled: preference.shuffleEnabled,
    repeatMode: normalizeRepeatMode(preference.repeatMode),
  };

  logger.debug({ userId, preferences: data }, 'Playback preferences updated');

  return data;
}

// ============================================================================
// Progress Operations
// ============================================================================

/**
 * Get playback progress for user
 */
export async function getPlaybackProgress(userId: string): Promise<PlaybackProgressResponse | null> {
  const progress = await prisma.playbackProgress.findUnique({
    where: { userId },
  });

  if (!progress) {
    return null;
  }

  const song = await prisma.song.findFirst({
    where: {
      id: progress.songId,
      library: { userId },
    },
    select: {
      id: true,
      title: true,
      artist: true,
      album: true,
      coverUrl: true,
      file: {
        select: {
          duration: true,
          mimeType: true,
        },
      },
    },
  });

  if (!song) {
    logger.warn(
      { userId, songId: progress.songId },
      'Playback progress refers to inaccessible song'
    );
    return null;
  }

  return {
    track: {
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      coverUrl: resolveCoverUrl({ id: song.id, coverUrl: song.coverUrl }),
      duration: song.file.duration ?? undefined,
      audioUrl: buildAudioUrl(song.id),
      mimeType: song.file.mimeType ?? undefined,
    },
    position: progress.position,
    context: mapPlaybackContext(progress.contextType, progress.contextId, progress.contextName),
    updatedAt: progress.updatedAt.toISOString(),
  };
}

/**
 * Update playback progress
 * Returns true if successful, false if song not found
 */
export async function updatePlaybackProgress(
  userId: string,
  data: {
    songId: string;
    position: number;
    contextType?: string;
    contextId?: string;
    contextName?: string;
  }
): Promise<boolean> {
  // Verify song belongs to user
  const song = await prisma.song.findFirst({
    where: {
      id: data.songId,
      library: { userId },
    },
  });

  if (!song) {
    logger.warn(
      { userId, songId: data.songId },
      'Attempted to update progress for inaccessible song'
    );
    return false;
  }

  await prisma.playbackProgress.upsert({
    where: { userId },
    create: {
      userId,
      songId: data.songId,
      position: data.position,
      contextType: data.contextType,
      contextId: data.contextId,
      contextName: data.contextName,
    },
    update: {
      songId: data.songId,
      position: data.position,
      contextType: data.contextType,
      contextId: data.contextId,
      contextName: data.contextName,
    },
  });

  logger.debug(
    { userId, songId: data.songId, position: data.position },
    'Playback progress updated'
  );

  return true;
}
