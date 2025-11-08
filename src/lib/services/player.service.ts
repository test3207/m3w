import type { File, Prisma, Song } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { RepeatMode } from '@/lib/audio/queue';

export type PlaybackSeedContextType = 'playlist' | 'library';

export interface PlaybackSeedContext {
  type: PlaybackSeedContextType;
  id: string;
  name: string;
}

export interface PlaybackSeed {
  track: Song & { file: File };
  context: PlaybackSeedContext;
}

export interface PlaybackPreferences {
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
}

export type PlaybackContextType = 'library' | 'playlist' | 'album' | 'search' | 'queue';

export interface PlaybackContext {
  type: PlaybackContextType;
  id: string;
  name: string | null;
}

export interface PlaybackProgressRecord {
  track: Song & { file: File };
  position: number;
  context: PlaybackContext | null;
  updatedAt: Date;
}

export const DEFAULT_PLAYBACK_PREFERENCES: PlaybackPreferences = {
  shuffleEnabled: false,
  repeatMode: RepeatMode.OFF,
};

const repeatModeValues = [RepeatMode.OFF, RepeatMode.ALL, RepeatMode.ONE] as const;
const playbackContextValues = [
  'library',
  'playlist',
  'album',
  'search',
  'queue',
] as const satisfies readonly PlaybackContextType[];

export const playbackPreferenceUpdateSchema = z
  .object({
    shuffleEnabled: z.boolean().optional(),
    repeatMode: z.enum(repeatModeValues).optional(),
  })
  .refine(
    (value) => value.shuffleEnabled !== undefined || value.repeatMode !== undefined,
    { message: 'At least one field must be provided.' }
  );

export type PlaybackPreferencesUpdate = z.infer<typeof playbackPreferenceUpdateSchema>;

export const playbackProgressUpdateSchema = z
  .object({
    songId: z.string().min(1),
    position: z.number().int().min(0).max(86_400),
    contextType: z.enum(playbackContextValues).optional(),
    contextId: z.string().min(1).optional(),
    contextName: z.string().min(1).optional(),
  })
  .refine(
    (value) =>
      (value.contextType && value.contextId) || (!value.contextType && !value.contextId),
    {
      message: 'contextId is required when contextType is provided.',
      path: ['contextId'],
    }
  );

export type PlaybackProgressUpdate = z.infer<typeof playbackProgressUpdateSchema>;

type PlaylistWithFirstSong = Prisma.PlaylistGetPayload<{
  include: {
    songs: {
      include: {
        song: {
          include: {
            file: true;
          };
        };
      };
    };
  };
}>;

type LibraryWithFirstSong = Prisma.LibraryGetPayload<{
  include: {
    songs: {
      include: {
        file: true;
      };
    };
  };
}>;

export async function getDefaultPlaybackSeed(userId: string): Promise<PlaybackSeed | null> {
  try {
    const playlist: PlaylistWithFirstSong | null = await prisma.playlist.findFirst({
      where: {
        userId,
        songs: {
          some: {},
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        songs: {
          orderBy: {
            order: 'asc',
          },
          take: 1,
          include: {
            song: {
              include: {
                file: true,
              },
            },
          },
        },
      },
    });

    const playlistSong = playlist?.songs[0]?.song;

    if (playlist && playlistSong) {
      logger.debug({
        msg: 'Resolved playback seed from playlist',
        playlistId: playlist.id,
        songId: playlistSong.id,
        userId,
      });

      return {
        track: playlistSong,
        context: {
          type: 'playlist',
          id: playlist.id,
          name: playlist.name,
        },
      } satisfies PlaybackSeed;
    }

    const library: LibraryWithFirstSong | null = await prisma.library.findFirst({
      where: {
        userId,
        songs: {
          some: {},
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        songs: {
          orderBy: {
            createdAt: 'asc',
          },
          take: 1,
          include: {
            file: true,
          },
        },
      },
    });

    const librarySong = library?.songs[0];

    if (library && librarySong) {
      logger.debug({
        msg: 'Resolved playback seed from library',
        libraryId: library.id,
        songId: librarySong.id,
        userId,
      });

      return {
        track: librarySong,
        context: {
          type: 'library',
          id: library.id,
          name: library.name,
        },
      } satisfies PlaybackSeed;
    }

    logger.debug({
      msg: 'No playback seed available for user',
      userId,
    });

    return null;
  } catch (error) {
    logger.error({
      msg: 'Failed to resolve default playback seed',
      userId,
      error,
    });
    throw error;
  }
}

export async function getPlaybackPreferences(userId: string): Promise<PlaybackPreferences> {
  try {
    const preference = await prisma.playbackPreference.findUnique({
      where: { userId },
    });

    if (!preference) {
      return DEFAULT_PLAYBACK_PREFERENCES;
    }

    const repeatMode = normalizeRepeatMode(preference.repeatMode);

    return {
      shuffleEnabled: preference.shuffleEnabled,
      repeatMode,
    } satisfies PlaybackPreferences;
  } catch (error) {
    logger.error({
      msg: 'Failed to retrieve playback preferences',
      userId,
      error,
    });
    throw error;
  }
}

export async function updatePlaybackPreferences(
  userId: string,
  input: PlaybackPreferencesUpdate
): Promise<PlaybackPreferences> {
  try {
    const payload = playbackPreferenceUpdateSchema.parse(input);

    const preference = await prisma.playbackPreference.upsert({
      where: { userId },
      create: {
        userId,
        shuffleEnabled:
          payload.shuffleEnabled ?? DEFAULT_PLAYBACK_PREFERENCES.shuffleEnabled,
        repeatMode: payload.repeatMode ?? DEFAULT_PLAYBACK_PREFERENCES.repeatMode,
      },
      update: {
        ...(payload.shuffleEnabled !== undefined
          ? { shuffleEnabled: payload.shuffleEnabled }
          : {}),
        ...(payload.repeatMode !== undefined
          ? { repeatMode: payload.repeatMode }
          : {}),
      },
    });

    const normalized: PlaybackPreferences = {
      shuffleEnabled: preference.shuffleEnabled,
      repeatMode: normalizeRepeatMode(preference.repeatMode),
    };

    logger.debug({
      msg: 'Playback preferences updated',
      userId,
      shuffleEnabled: normalized.shuffleEnabled,
      repeatMode: normalized.repeatMode,
    });

    return normalized;
  } catch (error) {
    logger.error({
      msg: 'Failed to update playback preferences',
      userId,
      error,
    });
    throw error;
  }
}

function normalizeRepeatMode(value: string | null | undefined): RepeatMode {
  if (!value) {
    return DEFAULT_PLAYBACK_PREFERENCES.repeatMode;
  }

  const candidate = value as RepeatMode;
  return repeatModeValues.includes(candidate)
    ? candidate
    : DEFAULT_PLAYBACK_PREFERENCES.repeatMode;
}

export async function getPlaybackProgress(
  userId: string
): Promise<PlaybackProgressRecord | null> {
  try {
    const progress = await prisma.playbackProgress.findUnique({
      where: { userId },
    });

    if (!progress) {
      return null;
    }

    const song = await prisma.song.findFirst({
      where: {
        id: progress.songId,
        library: {
          userId,
        },
      },
      include: {
        file: true,
      },
    });

    if (!song) {
      logger.warn({
        msg: 'Playback progress refers to inaccessible song; skipping',
        userId,
        songId: progress.songId,
      });
      return null;
    }

    const context = mapPlaybackContext(progress.contextType, progress.contextId, progress.contextName);

    return {
      track: song,
      position: progress.position,
      context,
      updatedAt: progress.updatedAt,
    } satisfies PlaybackProgressRecord;
  } catch (error) {
    logger.error({
      msg: 'Failed to retrieve playback progress',
      userId,
      error,
    });
    throw error;
  }
}

export async function updatePlaybackProgress(
  userId: string,
  input: PlaybackProgressUpdate
): Promise<PlaybackProgressRecord> {
  try {
    const payload = playbackProgressUpdateSchema.parse(input);

    const song = await prisma.song.findFirst({
      where: {
        id: payload.songId,
        library: {
          userId,
        },
      },
      include: {
        file: true,
      },
    });

    if (!song) {
      logger.warn({
        msg: 'Attempted to update playback progress for inaccessible song',
        userId,
        songId: payload.songId,
      });
      throw new Error('Song not found for user');
    }

    const progress = await prisma.playbackProgress.upsert({
      where: { userId },
      create: {
        userId,
        songId: payload.songId,
        position: payload.position,
        contextType: payload.contextType,
        contextId: payload.contextId,
        contextName: payload.contextName,
      },
      update: {
        songId: payload.songId,
        position: payload.position,
        contextType: payload.contextType,
        contextId: payload.contextId,
        contextName: payload.contextName,
      },
    });

    const context = mapPlaybackContext(
      progress.contextType,
      progress.contextId,
      progress.contextName
    );

    logger.debug({
      msg: 'Playback progress updated',
      userId,
      songId: progress.songId,
      position: progress.position,
      context,
    });

    return {
      track: song,
      position: progress.position,
      context,
      updatedAt: progress.updatedAt,
    } satisfies PlaybackProgressRecord;
  } catch (error) {
    logger.error({
      msg: 'Failed to update playback progress',
      userId,
      error,
    });
    throw error;
  }
}

function mapPlaybackContext(
  type: string | null | undefined,
  id: string | null | undefined,
  name: string | null | undefined
): PlaybackContext | null {
  if (!type || !id) {
    return null;
  }

  if (!playbackContextValues.includes(type as PlaybackContextType)) {
    return null;
  }

  return {
    type: type as PlaybackContextType,
    id,
    name: name ?? null,
  } satisfies PlaybackContext;
}
