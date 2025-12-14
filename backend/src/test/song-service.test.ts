/**
 * Song Service Unit Tests
 * Tests for pure functions in song.service.ts
 */

import { describe, it, expect } from 'vitest';
import { sortSongs } from '../services/song.service';
import type { SongSortOption } from '@m3w/shared';

// Factory for creating test songs
function createSong(overrides: Partial<{
  title: string;
  artist: string | null;
  album: string | null;
  createdAt: Date;
}> = {}) {
  return {
    title: overrides.title ?? 'Test Song',
    artist: overrides.artist ?? 'Test Artist',
    album: overrides.album ?? 'Test Album',
    createdAt: overrides.createdAt ?? new Date('2024-01-01'),
  };
}

describe('sortSongs', () => {
  describe('date sorting', () => {
    it('sorts by date descending (newest first) by default', () => {
      const songs = [
        createSong({ title: 'Old', createdAt: new Date('2024-01-01') }),
        createSong({ title: 'New', createdAt: new Date('2024-06-01') }),
        createSong({ title: 'Mid', createdAt: new Date('2024-03-01') }),
      ];

      const sorted = sortSongs(songs, 'date-desc');

      expect(sorted[0].title).toBe('New');
      expect(sorted[1].title).toBe('Mid');
      expect(sorted[2].title).toBe('Old');
    });

    it('sorts by date ascending (oldest first)', () => {
      const songs = [
        createSong({ title: 'New', createdAt: new Date('2024-06-01') }),
        createSong({ title: 'Old', createdAt: new Date('2024-01-01') }),
        createSong({ title: 'Mid', createdAt: new Date('2024-03-01') }),
      ];

      const sorted = sortSongs(songs, 'date-asc');

      expect(sorted[0].title).toBe('Old');
      expect(sorted[1].title).toBe('Mid');
      expect(sorted[2].title).toBe('New');
    });

    it('uses date-desc as fallback for unknown sort options', () => {
      const songs = [
        createSong({ title: 'Old', createdAt: new Date('2024-01-01') }),
        createSong({ title: 'New', createdAt: new Date('2024-06-01') }),
      ];

      const sorted = sortSongs(songs, 'unknown' as SongSortOption);

      expect(sorted[0].title).toBe('New');
      expect(sorted[1].title).toBe('Old');
    });
  });

  describe('title sorting', () => {
    it('sorts by title ascending (A-Z)', () => {
      const songs = [
        createSong({ title: 'Zebra' }),
        createSong({ title: 'Apple' }),
        createSong({ title: 'Mango' }),
      ];

      const sorted = sortSongs(songs, 'title-asc');

      expect(sorted[0].title).toBe('Apple');
      expect(sorted[1].title).toBe('Mango');
      expect(sorted[2].title).toBe('Zebra');
    });

    it('sorts by title descending (Z-A)', () => {
      const songs = [
        createSong({ title: 'Apple' }),
        createSong({ title: 'Zebra' }),
        createSong({ title: 'Mango' }),
      ];

      const sorted = sortSongs(songs, 'title-desc');

      expect(sorted[0].title).toBe('Zebra');
      expect(sorted[1].title).toBe('Mango');
      expect(sorted[2].title).toBe('Apple');
    });

    it('handles Chinese titles with Pinyin sorting', () => {
      const songs = [
        createSong({ title: '中文' }), // zhong wen
        createSong({ title: '阿里' }), // a li
        createSong({ title: '北京' }), // bei jing
      ];

      const sorted = sortSongs(songs, 'title-asc');

      // Pinyin order: a li < bei jing < zhong wen
      expect(sorted[0].title).toBe('阿里');
      expect(sorted[1].title).toBe('北京');
      expect(sorted[2].title).toBe('中文');
    });
  });

  describe('artist sorting', () => {
    it('sorts by artist ascending', () => {
      const songs = [
        createSong({ artist: 'Zedd' }),
        createSong({ artist: 'ABBA' }),
        createSong({ artist: 'Madonna' }),
      ];

      const sorted = sortSongs(songs, 'artist-asc');

      expect(sorted[0].artist).toBe('ABBA');
      expect(sorted[1].artist).toBe('Madonna');
      expect(sorted[2].artist).toBe('Zedd');
    });

    it('handles null artists without error', () => {
      const songs = [
        createSong({ artist: 'Zedd' }),
        createSong({ artist: null }),
        createSong({ artist: 'ABBA' }),
      ];

      // Should not throw and should return all songs
      const sorted = sortSongs(songs, 'artist-asc');
      expect(sorted).toHaveLength(3);

      // Verify all original songs are present
      const originalArtists = songs.map(s => s.artist).sort();
      const sortedArtists = sorted.map(s => s.artist).sort();
      expect(sortedArtists).toEqual(originalArtists);
    });
  });

  describe('album sorting', () => {
    it('sorts by album ascending', () => {
      const songs = [
        createSong({ album: 'Zulu Album' }),
        createSong({ album: 'Alpha Album' }),
        createSong({ album: 'Mega Album' }),
      ];

      const sorted = sortSongs(songs, 'album-asc');

      expect(sorted[0].album).toBe('Alpha Album');
      expect(sorted[1].album).toBe('Mega Album');
      expect(sorted[2].album).toBe('Zulu Album');
    });

    it('handles null albums without error', () => {
      const songs = [
        createSong({ album: 'Zulu Album' }),
        createSong({ album: null }),
        createSong({ album: 'Alpha Album' }),
      ];

      // Should not throw and should return all songs
      const sorted = sortSongs(songs, 'album-asc');
      expect(sorted).toHaveLength(3);

      // Verify all original songs are present
      const originalAlbums = songs.map(s => s.album).sort();
      const sortedAlbums = sorted.map(s => s.album).sort();
      expect(sortedAlbums).toEqual(originalAlbums);
    });
  });

  describe('immutability', () => {
    it('does not modify the original array', () => {
      const original = [
        createSong({ title: 'B' }),
        createSong({ title: 'A' }),
      ];
      const originalTitles = original.map(s => s.title);

      sortSongs(original, 'title-asc');

      expect(original.map(s => s.title)).toEqual(originalTitles);
    });
  });

  describe('edge cases', () => {
    it('handles empty array', () => {
      const sorted = sortSongs([], 'title-asc');
      expect(sorted).toEqual([]);
    });

    it('handles single element array', () => {
      const songs = [createSong({ title: 'Only' })];
      const sorted = sortSongs(songs, 'title-asc');

      expect(sorted).toHaveLength(1);
      expect(sorted[0].title).toBe('Only');
    });
  });
});
