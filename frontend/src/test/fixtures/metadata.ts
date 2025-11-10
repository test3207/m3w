import type { IAudioMetadata } from 'music-metadata';

export interface MetadataFixtureOptions {
  title?: string;
  artist?: string;
  duration?: number | null;
  bitrate?: number | null;
  sampleRate?: number | null;
  channels?: number | null;
}

const DEFAULT_OPTIONS: Required<Omit<MetadataFixtureOptions, 'duration' | 'bitrate' | 'sampleRate' | 'channels'>> & {
  duration: number | null;
  bitrate: number | null;
  sampleRate: number | null;
  channels: number | null;
} = {
  title: 'Fixture Title',
  artist: 'Fixture Artist',
  duration: null,
  bitrate: null,
  sampleRate: null,
  channels: null,
};

export function createMetadataFixture(options: MetadataFixtureOptions = {}): IAudioMetadata {
  const merged = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const metadata = {
    format: {
      trackInfo: [],
      tagTypes: [],
      duration: merged.duration ?? undefined,
      bitrate: merged.bitrate ?? undefined,
      sampleRate: merged.sampleRate ?? undefined,
      numberOfChannels: merged.channels ?? undefined,
    },
    common: {
      title: merged.title,
      artist: merged.artist,
      genre: [],
      track: { no: null, of: null },
      disk: { no: null, of: null },
      movementIndex: { no: null, of: null },
      composer: [],
      picture: [],
      lyrics: [],
    },
    native: {},
    quality: {
      warnings: [],
    },
  } satisfies IAudioMetadata;

  return metadata;
}
