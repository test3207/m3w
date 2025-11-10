import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { File, PlaylistSong, Song } from '@prisma/client';

import {
  DEFAULT_PLAYBACK_PREFERENCES,
  getDefaultPlaybackSeed,
  getPlaybackPreferences,
  getPlaybackProgress,
  updatePlaybackPreferences,
  updatePlaybackProgress,
} from './player.service';
import { RepeatMode } from '@/lib/audio/queue';

const {
  prismaPlaylistMock,
  prismaLibraryMock,
  prismaPlaybackPreferenceMock,
  prismaPlaybackProgressMock,
  prismaSongMock,
  loggerMock,
} = vi.hoisted(() => {
  const playlist = {
    findFirst: vi.fn(),
  };

  const library = {
    findFirst: vi.fn(),
  };

  const playbackPreference = {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  };

  const playbackProgress = {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  };

  const song = {
    findFirst: vi.fn(),
  };

  const logger = {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };

  return {
    prismaPlaylistMock: playlist,
    prismaLibraryMock: library,
    prismaPlaybackPreferenceMock: playbackPreference,
    prismaPlaybackProgressMock: playbackProgress,
    prismaSongMock: song,
    loggerMock: logger,
  };
});

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    playlist: prismaPlaylistMock,
    library: prismaLibraryMock,
    playbackPreference: prismaPlaybackPreferenceMock,
    playbackProgress: prismaPlaybackProgressMock,
    song: prismaSongMock,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: loggerMock,
}));

describe('player.service', () => {
  const userId = 'user-1';

  beforeEach(() => {
    vi.clearAllMocks();

    prismaPlaybackPreferenceMock.findUnique.mockReset();
    prismaPlaybackPreferenceMock.upsert.mockReset();
    prismaPlaybackProgressMock.findUnique.mockReset();
    prismaPlaybackProgressMock.upsert.mockReset();
    prismaSongMock.findFirst.mockReset();
    loggerMock.warn.mockReset();
  });

  const createFile = (overrides: Partial<File> = {}): File => ({
    id: overrides.id ?? 'file-1',
    hash: overrides.hash ?? 'hash-1',
    path: overrides.path ?? 'files/hash-1.mp3',
    size: overrides.size ?? 1024,
    mimeType: overrides.mimeType ?? 'audio/mpeg',
    duration: overrides.duration ?? 200,
    bitrate: overrides.bitrate ?? 320,
    sampleRate: overrides.sampleRate ?? 44100,
    channels: overrides.channels ?? 2,
    refCount: overrides.refCount ?? 1,
    createdAt: overrides.createdAt ?? new Date('2025-01-01T00:00:00.000Z'),
  });

  const createSong = (overrides: Partial<Song & { file: File }> = {}): Song & { file: File } => ({
    id: overrides.id ?? 'song-1',
    title: overrides.title ?? 'Song Title',
    artist: overrides.artist ?? 'Artist',
    album: overrides.album ?? null,
    albumArtist: overrides.albumArtist ?? null,
    year: overrides.year ?? null,
    genre: overrides.genre ?? null,
    trackNumber: overrides.trackNumber ?? null,
    discNumber: overrides.discNumber ?? null,
    composer: overrides.composer ?? null,
    fileId: overrides.fileId ?? 'file-1',
    coverUrl: overrides.coverUrl ?? null,
    libraryId: overrides.libraryId ?? 'library-1',
    rawMetadata: overrides.rawMetadata ?? null,
    createdAt: overrides.createdAt ?? new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2025-01-01T00:00:00.000Z'),
    file: overrides.file ?? createFile(),
  });

  const createPlaylistSong = (
    overrides: Partial<PlaylistSong & { song: Song & { file: File } }> = {}
  ): PlaylistSong & { song: Song & { file: File } } => ({
    playlistId: overrides.playlistId ?? 'playlist-1',
    songId: overrides.songId ?? 'song-1',
    order: overrides.order ?? 0,
    addedAt: overrides.addedAt ?? new Date('2025-01-01T00:00:00.000Z'),
    song: overrides.song ?? createSong(),
  });

  it('returns playback seed from the earliest playlist song when available', async () => {
    const playlist = {
      id: 'playlist-1',
      name: 'Morning Mix',
      description: null,
      coverUrl: null,
      userId,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      songs: [createPlaylistSong()],
    };

    prismaPlaylistMock.findFirst.mockResolvedValueOnce(playlist);

    const seed = await getDefaultPlaybackSeed(userId);

    expect(seed).not.toBeNull();
    expect(seed?.context).toEqual({
      type: 'playlist',
      id: 'playlist-1',
      name: 'Morning Mix',
    });
    expect(seed?.track.id).toBe('song-1');
    expect(prismaLibraryMock.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to earliest library song when playlists are empty', async () => {
    prismaPlaylistMock.findFirst.mockResolvedValueOnce(null);

    const library = {
      id: 'library-1',
      name: 'Jazz Library',
      description: null,
      userId,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      songs: [createSong({ id: 'song-2' })],
    };

    prismaLibraryMock.findFirst.mockResolvedValueOnce(library);

    const seed = await getDefaultPlaybackSeed(userId);

    expect(seed).not.toBeNull();
    expect(seed?.context).toEqual({
      type: 'library',
      id: 'library-1',
      name: 'Jazz Library',
    });
    expect(seed?.track.id).toBe('song-2');
  });

  it('returns null when no playback sources exist', async () => {
    prismaPlaylistMock.findFirst.mockResolvedValueOnce(null);
    prismaLibraryMock.findFirst.mockResolvedValueOnce(null);

    const seed = await getDefaultPlaybackSeed(userId);

    expect(seed).toBeNull();
  });

  describe('playback preferences', () => {
    it('returns defaults when preference does not exist', async () => {
      prismaPlaybackPreferenceMock.findUnique.mockResolvedValueOnce(null);

      const preferences = await getPlaybackPreferences(userId);

      expect(preferences).toEqual(DEFAULT_PLAYBACK_PREFERENCES);
      expect(prismaPlaybackPreferenceMock.findUnique).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('normalizes repeat mode from stored preferences', async () => {
      prismaPlaybackPreferenceMock.findUnique.mockResolvedValueOnce({
        userId,
        shuffleEnabled: true,
        repeatMode: RepeatMode.ALL,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const preferences = await getPlaybackPreferences(userId);

  expect(preferences).toEqual({ shuffleEnabled: true, repeatMode: RepeatMode.ALL });
    });

    it('falls back to default repeat mode when stored value is invalid', async () => {
      prismaPlaybackPreferenceMock.findUnique.mockResolvedValueOnce({
        userId,
        shuffleEnabled: false,
        repeatMode: 'invalid-mode',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const preferences = await getPlaybackPreferences(userId);

  expect(preferences.repeatMode).toBe(RepeatMode.OFF);
    });

    it('creates playback preferences when none exist on update', async () => {
      prismaPlaybackPreferenceMock.upsert.mockResolvedValueOnce({
        userId,
        shuffleEnabled: true,
        repeatMode: RepeatMode.OFF,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await updatePlaybackPreferences(userId, { shuffleEnabled: true });

      expect(prismaPlaybackPreferenceMock.upsert).toHaveBeenCalledWith({
        where: { userId },
        create: {
          userId,
          shuffleEnabled: true,
          repeatMode: RepeatMode.OFF,
        },
        update: {
          shuffleEnabled: true,
        },
      });
  expect(result).toEqual({ shuffleEnabled: true, repeatMode: RepeatMode.OFF });
    });

    it('updates only provided fields and preserves others', async () => {
      prismaPlaybackPreferenceMock.upsert.mockResolvedValueOnce({
        userId,
        shuffleEnabled: true,
        repeatMode: RepeatMode.ONE,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

  const result = await updatePlaybackPreferences(userId, { repeatMode: RepeatMode.ONE });

      expect(prismaPlaybackPreferenceMock.upsert).toHaveBeenCalledWith({
        where: { userId },
        create: {
          userId,
          shuffleEnabled: false,
          repeatMode: RepeatMode.ONE,
        },
        update: {
          repeatMode: RepeatMode.ONE,
        },
      });
  expect(result).toEqual({ shuffleEnabled: true, repeatMode: RepeatMode.ONE });
    });

    it('throws when update payload is empty', async () => {
      await expect(updatePlaybackPreferences(userId, {} as never)).rejects.toThrow();
      expect(loggerMock.error).toHaveBeenCalled();
    });
  });

  describe('playback progress', () => {
    it('returns null when no progress is stored', async () => {
      prismaPlaybackProgressMock.findUnique.mockResolvedValueOnce(null);

      const result = await getPlaybackProgress(userId);

      expect(result).toBeNull();
      expect(prismaPlaybackProgressMock.findUnique).toHaveBeenCalledWith({ where: { userId } });
    });

    it('returns playback progress with context', async () => {
      const progressRecord = {
        userId,
        songId: 'song-1',
        position: 123,
        contextType: 'playlist',
        contextId: 'playlist-1',
        contextName: 'Morning Mix',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-02T00:00:00.000Z'),
      };
      prismaPlaybackProgressMock.findUnique.mockResolvedValueOnce(progressRecord);

      const song = createSong();
      prismaSongMock.findFirst.mockResolvedValueOnce(song);

      const result = await getPlaybackProgress(userId);

      expect(prismaSongMock.findFirst).toHaveBeenCalledWith({
        where: { id: 'song-1', library: { userId } },
        include: { file: true },
      });
      expect(result).not.toBeNull();
      expect(result?.track.id).toBe('song-1');
      expect(result?.position).toBe(123);
      expect(result?.context).toEqual({
        type: 'playlist',
        id: 'playlist-1',
        name: 'Morning Mix',
      });
      expect(result?.updatedAt).toEqual(progressRecord.updatedAt);
    });

    it('returns null when progress song is inaccessible', async () => {
      const progressRecord = {
        userId,
        songId: 'song-unknown',
        position: 10,
        contextType: null,
        contextId: null,
        contextName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaPlaybackProgressMock.findUnique.mockResolvedValueOnce(progressRecord);
      prismaSongMock.findFirst.mockResolvedValueOnce(null);

      const result = await getPlaybackProgress(userId);

      expect(result).toBeNull();
      expect(loggerMock.warn).toHaveBeenCalled();
    });

    it('updates playback progress and returns normalized record', async () => {
      const song = createSong();
      prismaSongMock.findFirst.mockResolvedValueOnce(song);
      const upsertResult = {
        userId,
        songId: song.id,
        position: 45,
        contextType: 'library',
        contextId: 'library-1',
        contextName: 'Jazz Library',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T01:00:00.000Z'),
      };
      prismaPlaybackProgressMock.upsert.mockResolvedValueOnce(upsertResult);

      const result = await updatePlaybackProgress(userId, {
        songId: song.id,
        position: 45,
        contextType: 'library',
        contextId: 'library-1',
        contextName: 'Jazz Library',
      });

      expect(prismaPlaybackProgressMock.upsert).toHaveBeenCalledWith({
        where: { userId },
        create: {
          userId,
          songId: song.id,
          position: 45,
          contextType: 'library',
          contextId: 'library-1',
          contextName: 'Jazz Library',
        },
        update: {
          songId: song.id,
          position: 45,
          contextType: 'library',
          contextId: 'library-1',
          contextName: 'Jazz Library',
        },
      });

      expect(result.track.id).toBe(song.id);
      expect(result.position).toBe(45);
      expect(result.context).toEqual({
        type: 'library',
        id: 'library-1',
        name: 'Jazz Library',
      });
      expect(result.updatedAt).toEqual(upsertResult.updatedAt);
    });

    it('throws when updating progress with inaccessible song', async () => {
      prismaSongMock.findFirst.mockResolvedValueOnce(null);

      await expect(
        updatePlaybackProgress(userId, {
          songId: 'missing',
          position: 0,
        })
      ).rejects.toThrow('Song not found for user');
      expect(loggerMock.warn).toHaveBeenCalled();
    });
  });
});
