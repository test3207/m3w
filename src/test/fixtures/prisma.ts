import type { Library, Playlist, PlaylistSong } from '@prisma/client';

export interface LibraryFixtureOptions {
  id?: string;
  userId?: string;
  name?: string;
  description?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export function createLibraryFixture(options: LibraryFixtureOptions = {}): Library {
  const description =
    Object.prototype.hasOwnProperty.call(options, 'description')
      ? options.description ?? null
      : 'Fixture Description';

  return {
    id: options.id ?? 'library-fixture-id',
    userId: options.userId ?? 'user-fixture-id',
    name: options.name ?? 'Fixture Library',
    description,
    createdAt: options.createdAt ?? new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: options.updatedAt ?? new Date('2025-01-01T00:00:00.000Z'),
  } satisfies Library;
}

export interface PlaylistFixtureOptions {
  id?: string;
  userId?: string;
  name?: string;
  description?: string | null;
  coverUrl?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export function createPlaylistFixture(options: PlaylistFixtureOptions = {}): Playlist {
  const description = Object.prototype.hasOwnProperty.call(options, 'description')
    ? options.description ?? null
    : 'Fixture Playlist Description';

  return {
    id: options.id ?? 'playlist-fixture-id',
    userId: options.userId ?? 'user-fixture-id',
    name: options.name ?? 'Fixture Playlist',
    description,
    coverUrl: options.coverUrl ?? null,
    createdAt: options.createdAt ?? new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: options.updatedAt ?? new Date('2025-01-01T00:00:00.000Z'),
  } satisfies Playlist;
}

export interface PlaylistSongFixtureOptions {
  playlistId?: string;
  songId?: string;
  order?: number;
  addedAt?: Date;
}

export function createPlaylistSongFixture(options: PlaylistSongFixtureOptions = {}): PlaylistSong {
  return {
    playlistId: options.playlistId ?? 'playlist-fixture-id',
    songId: options.songId ?? 'song-fixture-id',
    order: options.order ?? 0,
    addedAt: options.addedAt ?? new Date('2025-01-01T00:00:00.000Z'),
  } satisfies PlaylistSong;
}
