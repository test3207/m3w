/**
 * Tests for offline-proxy song routes
 * These test the Guest mode song functionality backed by IndexedDB
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Mock the db module before importing routes
vi.mock("../../db/schema", () => ({
  db: {
    songs: {
      get: vi.fn(),
      delete: vi.fn(),
    },
    playlistSongs: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(),
          delete: vi.fn(),
        })),
      })),
    },
    libraries: {
      get: vi.fn(),
      update: vi.fn(),
    },
    playlists: {
      get: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock cache manager
vi.mock("../../pwa/cache-manager", () => ({
  deleteFromCache: vi.fn(),
}));

vi.mock("@/lib/logger-client", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks
import { songRoutes } from "./songs";
import { db } from "../../db/schema";
import { deleteFromCache } from "../../pwa/cache-manager";

// Create app with song routes
const app = new Hono();
app.route("/songs", songRoutes);

// Mock data
const mockSong = {
  id: "song-1",
  title: "Test Song",
  artist: "Test Artist",
  album: "Test Album",
  albumArtist: null,
  composer: null,
  duration: 180,
  coverUrl: "/covers/song-1.jpg",
  libraryId: "lib-1",
  libraryName: "My Library",
  isCached: true,
  lastCacheCheck: Date.now(),
  fileId: "file-1",
  fileHash: "abc123",
  trackNumber: 1,
  discNumber: 1,
  year: 2024,
  genre: "Rock",
  streamUrl: "/guest/songs/song-1/stream",
  userId: "guest-user-id",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const mockLibrary = {
  id: "lib-1",
  name: "My Library",
  songCount: 10,
  userId: "guest-user-id",
};

const mockPlaylist = {
  id: "playlist-1",
  name: "My Playlist",
  songCount: 5,
  userId: "guest-user-id",
};

describe("Offline Song Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /songs/:id", () => {
    it("should return song by ID", async () => {
      vi.mocked(db.songs.get).mockResolvedValue(mockSong);

      const res = await app.request("/songs/song-1");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe("song-1");
      expect(json.data.title).toBe("Test Song");

      expect(db.songs.get).toHaveBeenCalledWith("song-1");
    });

    it("should return 404 when song not found", async () => {
      vi.mocked(db.songs.get).mockResolvedValue(undefined);

      const res = await app.request("/songs/nonexistent");
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Song not found");
    });

    it("should return 500 on database error", async () => {
      vi.mocked(db.songs.get).mockRejectedValue(new Error("Database error"));

      const res = await app.request("/songs/song-1");
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Failed to fetch song");
    });
  });

  describe("DELETE /songs/:id", () => {
    it("should delete song and update counts", async () => {
      vi.mocked(db.songs.get).mockResolvedValue(mockSong);
      vi.mocked(db.songs.delete).mockResolvedValue(undefined);
      vi.mocked(db.libraries.get).mockResolvedValue(mockLibrary);
      vi.mocked(db.libraries.update).mockResolvedValue(1);
      vi.mocked(db.playlists.get).mockResolvedValue(mockPlaylist);
      vi.mocked(db.playlists.update).mockResolvedValue(1);
      vi.mocked(deleteFromCache).mockResolvedValue(undefined);

      // Mock playlistSongs to return affected playlists
      vi.mocked(db.playlistSongs.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            { playlistId: "playlist-1", songId: "song-1" },
          ]),
          delete: vi.fn().mockResolvedValue(1),
        }),
      } as never);

      const res = await app.request("/songs/song-1?libraryId=lib-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      expect(db.songs.delete).toHaveBeenCalledWith("song-1");
      expect(db.libraries.update).toHaveBeenCalledWith("lib-1", {
        songCount: 9,
      });
    });

    it("should return 400 when libraryId is missing", async () => {
      const res = await app.request("/songs/song-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("libraryId is required");
    });

    it("should return 404 when song not found", async () => {
      vi.mocked(db.songs.get).mockResolvedValue(undefined);

      const res = await app.request("/songs/nonexistent?libraryId=lib-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Song not found");
    });

    it("should return 403 when song belongs to different library", async () => {
      vi.mocked(db.songs.get).mockResolvedValue({
        ...mockSong,
        libraryId: "other-lib",
      });

      const res = await app.request("/songs/song-1?libraryId=lib-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Song does not belong to this library");
    });

    it("should delete cached audio and cover files", async () => {
      vi.mocked(db.songs.get).mockResolvedValue(mockSong);
      vi.mocked(db.songs.delete).mockResolvedValue(undefined);
      vi.mocked(db.libraries.get).mockResolvedValue(mockLibrary);
      vi.mocked(db.libraries.update).mockResolvedValue(1);
      vi.mocked(deleteFromCache).mockResolvedValue(undefined);

      vi.mocked(db.playlistSongs.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
          delete: vi.fn().mockResolvedValue(0),
        }),
      } as never);

      const res = await app.request("/songs/song-1?libraryId=lib-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);

      // Should delete both audio stream and cover using buildStreamUrl/buildCoverUrl paths
      expect(deleteFromCache).toHaveBeenCalledWith("/api/songs/song-1/stream");
      expect(deleteFromCache).toHaveBeenCalledWith("/api/songs/song-1/cover");
    });

    it("should not fail if cache deletion fails", async () => {
      vi.mocked(db.songs.get).mockResolvedValue(mockSong);
      vi.mocked(db.songs.delete).mockResolvedValue(undefined);
      vi.mocked(db.libraries.get).mockResolvedValue(mockLibrary);
      vi.mocked(db.libraries.update).mockResolvedValue(1);
      vi.mocked(deleteFromCache).mockRejectedValue(new Error("Cache error"));

      vi.mocked(db.playlistSongs.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
          delete: vi.fn().mockResolvedValue(0),
        }),
      } as never);

      const res = await app.request("/songs/song-1?libraryId=lib-1", {
        method: "DELETE",
      });

      // Should still succeed even if cache deletion fails
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it("should update multiple affected playlists", async () => {
      vi.mocked(db.songs.get).mockResolvedValue({ ...mockSong, coverUrl: null });
      vi.mocked(db.songs.delete).mockResolvedValue(undefined);
      vi.mocked(db.libraries.get).mockResolvedValue(mockLibrary);
      vi.mocked(db.libraries.update).mockResolvedValue(1);
      vi.mocked(deleteFromCache).mockResolvedValue(undefined);

      // Song is in multiple playlists
      vi.mocked(db.playlistSongs.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            { playlistId: "playlist-1", songId: "song-1" },
            { playlistId: "playlist-2", songId: "song-1" },
          ]),
          delete: vi.fn().mockResolvedValue(2),
        }),
      } as never);

      vi.mocked(db.playlists.get)
        .mockResolvedValueOnce({ ...mockPlaylist, id: "playlist-1", songCount: 5 })
        .mockResolvedValueOnce({ ...mockPlaylist, id: "playlist-2", songCount: 3 });

      const res = await app.request("/songs/song-1?libraryId=lib-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);

      // Should update both playlists
      expect(db.playlists.update).toHaveBeenCalledTimes(2);
      expect(db.playlists.update).toHaveBeenCalledWith("playlist-1", { songCount: 4 });
      expect(db.playlists.update).toHaveBeenCalledWith("playlist-2", { songCount: 2 });
    });
  });
});
