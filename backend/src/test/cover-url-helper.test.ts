/**
 * Cover URL Helper Tests
 *
 * Tests for cover URL resolution and conversion
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveCoverUrl, resolveCoverUrls } from "../lib/cover-url-helper";

describe("Cover URL Helper", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("resolveCoverUrl", () => {
    it("should return null when coverUrl is null", () => {
      const song = { id: "song-1", coverUrl: null };
      expect(resolveCoverUrl(song)).toBeNull();
    });

    it("should return null when coverUrl is empty string", () => {
      const song = { id: "song-1", coverUrl: "" };
      expect(resolveCoverUrl(song)).toBeNull();
    });

    it("should return external HTTP URL unchanged", () => {
      const song = { id: "song-1", coverUrl: "http://example.com/cover.jpg" };
      expect(resolveCoverUrl(song)).toBe("http://example.com/cover.jpg");
    });

    it("should return external HTTPS URL unchanged", () => {
      const song = { id: "song-1", coverUrl: "https://example.com/cover.jpg" };
      expect(resolveCoverUrl(song)).toBe("https://example.com/cover.jpg");
    });

    it("should convert MinIO path to API URL with default port", () => {
      delete process.env.API_BASE_URL;
      delete process.env.PORT;
      
      const song = { id: "song-123", coverUrl: "covers/abc123.jpg" };
      const result = resolveCoverUrl(song);
      
      expect(result).toBe("http://localhost:4000/api/songs/song-123/cover");
    });

    it("should use custom PORT when API_BASE_URL not set", () => {
      delete process.env.API_BASE_URL;
      process.env.PORT = "5000";
      
      const song = { id: "song-123", coverUrl: "covers/abc123.jpg" };
      const result = resolveCoverUrl(song);
      
      expect(result).toBe("http://localhost:5000/api/songs/song-123/cover");
    });

    it("should use API_BASE_URL when set", () => {
      process.env.API_BASE_URL = "https://api.example.com";
      
      const song = { id: "song-123", coverUrl: "covers/abc123.jpg" };
      const result = resolveCoverUrl(song);
      
      expect(result).toBe("https://api.example.com/api/songs/song-123/cover");
    });

    it("should handle MinIO paths with subdirectories", () => {
      delete process.env.API_BASE_URL;
      
      const song = { id: "song-1", coverUrl: "covers/2024/01/abc123.jpg" };
      const result = resolveCoverUrl(song);
      
      expect(result).toContain("/api/songs/song-1/cover");
    });

    it("should handle song ID with special characters", () => {
      delete process.env.API_BASE_URL;
      
      const song = { id: "clxyz123abc", coverUrl: "covers/hash.jpg" };
      const result = resolveCoverUrl(song);
      
      expect(result).toContain("/api/songs/clxyz123abc/cover");
    });
  });

  describe("resolveCoverUrls", () => {
    beforeEach(() => {
      delete process.env.API_BASE_URL;
      delete process.env.PORT;
    });

    it("should convert array of songs", () => {
      const songs = [
        { id: "song-1", coverUrl: "covers/a.jpg", title: "Song A" },
        { id: "song-2", coverUrl: null, title: "Song B" },
        { id: "song-3", coverUrl: "https://example.com/c.jpg", title: "Song C" },
      ];

      const result = resolveCoverUrls(songs);

      expect(result).toHaveLength(3);
      expect(result[0].coverUrl).toBe("http://localhost:4000/api/songs/song-1/cover");
      expect(result[1].coverUrl).toBeNull();
      expect(result[2].coverUrl).toBe("https://example.com/c.jpg");
    });

    it("should preserve other song properties", () => {
      const songs = [
        { id: "song-1", coverUrl: "covers/a.jpg", title: "My Song", artist: "Artist" },
      ];

      const result = resolveCoverUrls(songs);

      expect(result[0].title).toBe("My Song");
      expect(result[0].artist).toBe("Artist");
      expect(result[0].id).toBe("song-1");
    });

    it("should handle empty array", () => {
      const result = resolveCoverUrls([]);
      expect(result).toEqual([]);
    });

    it("should handle single item array", () => {
      const songs = [{ id: "song-1", coverUrl: "covers/a.jpg" }];
      const result = resolveCoverUrls(songs);
      
      expect(result).toHaveLength(1);
      expect(result[0].coverUrl).toContain("/api/songs/song-1/cover");
    });
  });
});
