import { describe, it, expect } from 'vitest';
import { generateFallbackMetadata } from './extractor';

describe('Metadata Extractor', () => {
  describe('generateFallbackMetadata', () => {
    it('should extract artist and title from "Artist - Title" pattern', () => {
      const result = generateFallbackMetadata('Jay Chou - Qi Li Xiang.mp3');
      
      expect(result.title).toBe('Qi Li Xiang');
      expect(result.artist).toBe('Jay Chou');
      expect(result.album).toBeNull();
    });

    it('should extract title from "01 - Title" pattern', () => {
      const result = generateFallbackMetadata('01 - Beautiful Song.mp3');
      
      expect(result.title).toBe('Beautiful Song');
      expect(result.artist).toBeNull();
    });

    it('should extract title from "01. Title" pattern', () => {
      const result = generateFallbackMetadata('01. Amazing Track.flac');
      
      expect(result.title).toBe('Amazing Track');
      expect(result.artist).toBeNull();
    });

    it('should use filename as title when no pattern matches', () => {
      const result = generateFallbackMetadata('SomeRandomSong.mp3');
      
      expect(result.title).toBe('SomeRandomSong');
      expect(result.artist).toBeNull();
    });

    it('should handle filenames with multiple dots', () => {
      const result = generateFallbackMetadata('Artist Name - Song.Title.With.Dots.mp3');
      
      expect(result.title).toBe('Song.Title.With.Dots');
      expect(result.artist).toBe('Artist Name');
    });

    it('should trim whitespace from extracted values', () => {
      const result = generateFallbackMetadata('  Artist  -  Title  .mp3');
      
      expect(result.title).toBe('Title');
      expect(result.artist).toBe('Artist');
    });

    it('should handle Chinese characters', () => {
      const result = generateFallbackMetadata('周杰伦 - 七里香.mp3');
      
      expect(result.title).toBe('七里香');
      expect(result.artist).toBe('周杰伦');
    });

    it('should return null for optional fields', () => {
      const result = generateFallbackMetadata('Test Song.mp3');
      
      expect(result.album).toBeNull();
      expect(result.albumArtist).toBeNull();
      expect(result.year).toBeNull();
      expect(result.genre).toBeNull();
      expect(result.trackNumber).toBeNull();
      expect(result.discNumber).toBeNull();
      expect(result.composer).toBeNull();
    });
  });
});
