/**
 * Shared Package - Transformers Tests
 *
 * Tests for API response transformer functions
 */

import { describe, it, expect } from "vitest";
import {
  toLibraryResponse,
  toPlaylistResponse,
  toSongResponse,
  toLibraryListResponse,
  toPlaylistListResponse,
  toSongListResponse,
} from "@m3w/shared";

describe("Transformers", () => {
  describe("toLibraryResponse", () => {
    it("should transform library with all fields", () => {
      const input = {
        id: "lib-1",
        name: "My Library",
        description: "Test description",
        userId: "user-1",
        songCount: 42,
        isDefault: false,
        canDelete: true,
        cacheOverride: "always" as const,
        coverUrl: "https://example.com/cover.jpg",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-02T00:00:00Z"),
      };

      const result = toLibraryResponse(input);

      expect(result).toEqual({
        id: "lib-1",
        name: "My Library",
        description: "Test description",
        userId: "user-1",
        songCount: 42,
        isDefault: false,
        canDelete: true,
        cacheOverride: "always",
        coverUrl: "https://example.com/cover.jpg",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
      });
    });

    it("should handle null description", () => {
      const input = {
        id: "lib-1",
        name: "My Library",
        description: null,
        userId: "user-1",
        songCount: 0,
        isDefault: true,
        canDelete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = toLibraryResponse(input);

      expect(result.description).toBeNull();
    });

    it("should default cacheOverride to inherit", () => {
      const input = {
        id: "lib-1",
        name: "My Library",
        description: null,
        userId: "user-1",
        songCount: 0,
        isDefault: false,
        canDelete: true,
        // cacheOverride not provided
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = toLibraryResponse(input);

      expect(result.cacheOverride).toBe("inherit");
    });

    it("should handle string dates", () => {
      const input = {
        id: "lib-1",
        name: "My Library",
        description: null,
        userId: "user-1",
        songCount: 0,
        isDefault: false,
        canDelete: true,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
      };

      const result = toLibraryResponse(input);

      expect(result.createdAt).toBe("2024-01-01T00:00:00.000Z");
      expect(result.updatedAt).toBe("2024-01-02T00:00:00.000Z");
    });

    it("should handle null coverUrl", () => {
      const input = {
        id: "lib-1",
        name: "My Library",
        description: null,
        userId: "user-1",
        songCount: 0,
        isDefault: false,
        canDelete: true,
        coverUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = toLibraryResponse(input);

      expect(result.coverUrl).toBeNull();
    });
  });

  describe("toPlaylistResponse", () => {
    it("should transform playlist with all fields", () => {
      const input = {
        id: "pl-1",
        name: "My Playlist",
        description: "Playlist description",
        userId: "user-1",
        songCount: 10,
        linkedLibraryId: "lib-1",
        isDefault: false,
        canDelete: true,
        coverUrl: "https://example.com/cover.jpg",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-02T00:00:00Z"),
      };

      const result = toPlaylistResponse(input);

      expect(result).toEqual({
        id: "pl-1",
        name: "My Playlist",
        description: "Playlist description",
        userId: "user-1",
        songCount: 10,
        linkedLibraryId: "lib-1",
        isDefault: false,
        canDelete: true,
        coverUrl: "https://example.com/cover.jpg",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
      });
    });

    it("should handle null linkedLibraryId", () => {
      const input = {
        id: "pl-1",
        name: "My Playlist",
        description: null,
        userId: "user-1",
        songCount: 0,
        linkedLibraryId: null,
        isDefault: true,
        canDelete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = toPlaylistResponse(input);

      expect(result.linkedLibraryId).toBeNull();
    });

    it("should handle undefined coverUrl", () => {
      const input = {
        id: "pl-1",
        name: "My Playlist",
        description: null,
        userId: "user-1",
        songCount: 0,
        linkedLibraryId: null,
        isDefault: false,
        canDelete: true,
        // coverUrl not provided
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = toPlaylistResponse(input);

      expect(result.coverUrl).toBeNull();
    });
  });

  describe("toSongResponse", () => {
    it("should transform song with all fields", () => {
      const input = {
        id: "song-1",
        title: "Test Song",
        artist: "Test Artist",
        album: "Test Album",
        albumArtist: "Album Artist",
        year: 2024,
        genre: "Rock",
        trackNumber: 1,
        discNumber: 1,
        composer: "Test Composer",
        coverUrl: "https://example.com/cover.jpg",
        fileId: "file-1",
        libraryId: "lib-1",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-02T00:00:00Z"),
        file: {
          duration: 180,
          mimeType: "audio/mpeg",
        },
        library: {
          name: "My Library",
        },
      };

      const result = toSongResponse(input);

      expect(result).toEqual({
        id: "song-1",
        title: "Test Song",
        artist: "Test Artist",
        album: "Test Album",
        albumArtist: "Album Artist",
        year: 2024,
        genre: "Rock",
        trackNumber: 1,
        discNumber: 1,
        composer: "Test Composer",
        coverUrl: "https://example.com/cover.jpg",
        fileId: "file-1",
        libraryId: "lib-1",
        libraryName: "My Library",
        duration: 180,
        mimeType: "audio/mpeg",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
      });
    });

    it("should handle null optional fields", () => {
      const input = {
        id: "song-1",
        title: "Test Song",
        artist: null,
        album: null,
        albumArtist: null,
        year: null,
        genre: null,
        trackNumber: null,
        discNumber: null,
        composer: null,
        coverUrl: null,
        fileId: "file-1",
        libraryId: "lib-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = toSongResponse(input);

      expect(result.artist).toBeNull();
      expect(result.album).toBeNull();
      expect(result.duration).toBeNull();
      expect(result.mimeType).toBeNull();
      expect(result.libraryName).toBeNull();
    });

    it("should prioritize direct fields over relations", () => {
      const input = {
        id: "song-1",
        title: "Test Song",
        artist: null,
        album: null,
        albumArtist: null,
        year: null,
        genre: null,
        trackNumber: null,
        discNumber: null,
        composer: null,
        coverUrl: null,
        fileId: "file-1",
        libraryId: "lib-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        // Direct fields
        duration: 200,
        mimeType: "audio/flac",
        libraryName: "Direct Library",
        // Relations (should be ignored)
        file: {
          duration: 180,
          mimeType: "audio/mpeg",
        },
        library: {
          name: "Relation Library",
        },
      };

      const result = toSongResponse(input);

      expect(result.duration).toBe(200);
      expect(result.mimeType).toBe("audio/flac");
      expect(result.libraryName).toBe("Direct Library");
    });

    it("should fallback to relations when direct fields not available", () => {
      const input = {
        id: "song-1",
        title: "Test Song",
        artist: null,
        album: null,
        albumArtist: null,
        year: null,
        genre: null,
        trackNumber: null,
        discNumber: null,
        composer: null,
        coverUrl: null,
        fileId: "file-1",
        libraryId: "lib-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        // Only relations provided
        file: {
          duration: 180,
          mimeType: "audio/mpeg",
        },
        library: {
          name: "My Library",
        },
      };

      const result = toSongResponse(input);

      expect(result.duration).toBe(180);
      expect(result.mimeType).toBe("audio/mpeg");
      expect(result.libraryName).toBe("My Library");
    });
  });

  describe("toLibraryListResponse", () => {
    it("should transform array of libraries", () => {
      const inputs = [
        {
          id: "lib-1",
          name: "Library 1",
          description: null,
          userId: "user-1",
          songCount: 10,
          isDefault: true,
          canDelete: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "lib-2",
          name: "Library 2",
          description: "Description",
          userId: "user-1",
          songCount: 20,
          isDefault: false,
          canDelete: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = toLibraryListResponse(inputs);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("lib-1");
      expect(result[1].id).toBe("lib-2");
    });

    it("should return empty array for empty input", () => {
      const result = toLibraryListResponse([]);
      expect(result).toEqual([]);
    });
  });

  describe("toPlaylistListResponse", () => {
    it("should transform array of playlists", () => {
      const inputs = [
        {
          id: "pl-1",
          name: "Playlist 1",
          description: null,
          userId: "user-1",
          songCount: 5,
          linkedLibraryId: null,
          isDefault: true,
          canDelete: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "pl-2",
          name: "Playlist 2",
          description: null,
          userId: "user-1",
          songCount: 15,
          linkedLibraryId: "lib-1",
          isDefault: false,
          canDelete: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = toPlaylistListResponse(inputs);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("pl-1");
      expect(result[1].id).toBe("pl-2");
    });
  });

  describe("toSongListResponse", () => {
    it("should transform array of songs", () => {
      const inputs = [
        {
          id: "song-1",
          title: "Song 1",
          artist: "Artist 1",
          album: null,
          albumArtist: null,
          year: null,
          genre: null,
          trackNumber: null,
          discNumber: null,
          composer: null,
          coverUrl: null,
          fileId: "file-1",
          libraryId: "lib-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "song-2",
          title: "Song 2",
          artist: "Artist 2",
          album: null,
          albumArtist: null,
          year: null,
          genre: null,
          trackNumber: null,
          discNumber: null,
          composer: null,
          coverUrl: null,
          fileId: "file-2",
          libraryId: "lib-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = toSongListResponse(inputs);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("Song 1");
      expect(result[1].title).toBe("Song 2");
    });
  });
});
