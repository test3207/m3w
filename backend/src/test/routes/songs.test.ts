import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import songsRoutes from "../../routes/songs";
import type { Song, ApiResponse, SongPlaylistCount } from "@m3w/shared";

// Mock Prisma
vi.mock("../../lib/prisma", () => ({
  prisma: {
    song: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    library: {
      findFirst: vi.fn(),
    },
    playlistSong: {
      deleteMany: vi.fn(),
    },
    file: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock song service
vi.mock("../../services/song.service", () => ({
  sortSongs: vi.fn((songs) => songs),
  searchSongs: vi.fn(),
  findSongById: vi.fn(),
  findSongForStreaming: vi.fn(),
  updateSong: vi.fn(),
  verifySongInLibrary: vi.fn(),
  countPlaylistsWithSong: vi.fn(),
  getPlaylistsContainingSong: vi.fn(),
  deleteSong: vi.fn(),
  cleanupFileAfterSongDeletion: vi.fn(),
}));

// Mock auth middleware
vi.mock("../../lib/auth-middleware", () => ({
  authMiddleware: vi.fn(async (c, next) => {
    c.set("auth", { userId: "test-user-id", email: "test@example.com" });
    await next();
  }),
}));

// Mock auth helper
vi.mock("../../lib/auth-helper", () => ({
  getUserId: vi.fn(() => "test-user-id"),
}));

// Mock logger
vi.mock("../../lib/logger", () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  return {
    logger: mockLogger,
    createLogger: vi.fn(() => mockLogger),
  };
});

// Import mocked modules for assertions
import * as songService from "../../services/song.service";

// Create app with songs routes
const app = new Hono();
app.route("/api/songs", songsRoutes);

// Full file mock data for service functions that return file info
const mockFile = {
  id: "file-1",
  createdAt: new Date("2024-01-01"),
  hash: "abc123",
  path: "audio/test.mp3",
  size: 5000000,
  mimeType: "audio/mpeg",
  duration: 180,
  bitrate: 320000,
  sampleRate: 44100,
  channels: 2,
  refCount: 1,
};

// For searchSongs (returns minimal file info)
const mockSearchSong = {
  id: "song-1",
  title: "Test Song",
  artist: "Test Artist",
  album: "Test Album",
  albumArtist: null,
  year: 2024,
  genre: "Pop",
  trackNumber: 1,
  discNumber: 1,
  composer: null,
  coverUrl: "covers/test.jpg",
  libraryId: "lib-1",
  fileId: "file-1",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  file: {
    duration: 180,
    mimeType: "audio/mpeg",
  },
  library: {
    name: "My Library",
  },
};

// For findSongById (returns full file info)
const mockSongWithFullFile = {
  id: "song-1",
  title: "Test Song",
  artist: "Test Artist",
  album: "Test Album",
  albumArtist: null,
  year: 2024,
  genre: "Pop",
  trackNumber: 1,
  discNumber: 1,
  composer: null,
  coverUrl: "covers/test.jpg",
  libraryId: "lib-1",
  fileId: "file-1",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  rawMetadata: null,
  file: mockFile,
  library: {
    name: "My Library",
  },
};

// For verifySongInLibrary (returns file, no library)
const mockSongForVerify = {
  id: "song-1",
  title: "Test Song",
  artist: "Test Artist",
  album: "Test Album",
  albumArtist: null,
  year: 2024,
  genre: "Pop",
  trackNumber: 1,
  discNumber: 1,
  composer: null,
  coverUrl: "covers/test.jpg",
  libraryId: "lib-1",
  fileId: "file-1",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  rawMetadata: null,
  file: mockFile,
};

// For updateSong (returns minimal file info)
const mockUpdatedSong = {
  id: "song-1",
  title: "Updated Title",
  artist: "Test Artist",
  album: "Test Album",
  albumArtist: null,
  year: 2024,
  genre: "Pop",
  trackNumber: 1,
  discNumber: 1,
  composer: null,
  coverUrl: "covers/test.jpg",
  libraryId: "lib-1",
  fileId: "file-1",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  rawMetadata: null,
  file: {
    duration: 180,
    mimeType: "audio/mpeg",
  },
  library: {
    name: "My Library",
  },
};

describe("Songs Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/songs/search", () => {
    it("should search songs with query", async () => {
      const songs = [mockSearchSong];
      vi.mocked(songService.searchSongs).mockResolvedValue(songs);
      vi.mocked(songService.sortSongs).mockReturnValue(songs);

      const res = await app.request("/api/songs/search?q=test");
      expect(res.status).toBe(200);

      const json = (await res.json()) as ApiResponse<Song[]>;
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(songService.searchSongs).toHaveBeenCalledWith("test-user-id", "test", undefined);
    });

    it("should search songs with libraryId filter", async () => {
      vi.mocked(songService.searchSongs).mockResolvedValue([mockSearchSong]);
      vi.mocked(songService.sortSongs).mockReturnValue([mockSearchSong]);

      const res = await app.request("/api/songs/search?q=test&libraryId=lib-1");
      expect(res.status).toBe(200);

      expect(songService.searchSongs).toHaveBeenCalledWith("test-user-id", "test", "lib-1");
    });

    it("should search songs with empty query", async () => {
      vi.mocked(songService.searchSongs).mockResolvedValue([]);
      vi.mocked(songService.sortSongs).mockReturnValue([]);

      const res = await app.request("/api/songs/search");
      expect(res.status).toBe(200);

      const json = (await res.json()) as ApiResponse<Song[]>;
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(0);
    });

    it("should return 500 on service error", async () => {
      vi.mocked(songService.searchSongs).mockRejectedValue(new Error("Database error"));

      const res = await app.request("/api/songs/search?q=test");
      expect(res.status).toBe(500);

      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Failed to search songs");
    });
  });

  describe("GET /api/songs/:id", () => {
    it("should return song by ID", async () => {
      vi.mocked(songService.findSongById).mockResolvedValue(mockSongWithFullFile);

      const res = await app.request("/api/songs/song-1");
      expect(res.status).toBe(200);

      const json = (await res.json()) as ApiResponse<Song>;
      expect(json.success).toBe(true);
      expect(json.data?.id).toBe("song-1");
      expect(json.data?.title).toBe("Test Song");
      expect(songService.findSongById).toHaveBeenCalledWith("song-1", "test-user-id");
    });

    it("should return 404 when song not found", async () => {
      vi.mocked(songService.findSongById).mockResolvedValue(null);

      const res = await app.request("/api/songs/nonexistent");
      expect(res.status).toBe(404);

      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Song not found");
    });

    it("should return 500 on service error", async () => {
      vi.mocked(songService.findSongById).mockRejectedValue(new Error("Database error"));

      const res = await app.request("/api/songs/song-1");
      expect(res.status).toBe(500);

      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Failed to fetch song");
    });
  });

  describe("PATCH /api/songs/:id", () => {
    it("should update song metadata", async () => {
      const { prisma } = await import("../../lib/prisma");
      vi.mocked(prisma.song.findFirst).mockResolvedValue(mockSongWithFullFile as never);
      vi.mocked(songService.updateSong).mockResolvedValue(mockUpdatedSong);

      const res = await app.request("/api/songs/song-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated Title" }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse<Song>;
      expect(json.success).toBe(true);
      expect(json.data?.title).toBe("Updated Title");
    });

    it("should return 404 when song not found for update", async () => {
      const { prisma } = await import("../../lib/prisma");
      vi.mocked(prisma.song.findFirst).mockResolvedValue(null);

      const res = await app.request("/api/songs/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated Title" }),
      });

      expect(res.status).toBe(404);
      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Song not found");
    });

    it("should return 400 for invalid update data", async () => {
      const res = await app.request("/api/songs/song-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "" }), // Empty title should fail validation
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(false);
    });

    it("should return 500 on service error", async () => {
      const { prisma } = await import("../../lib/prisma");
      vi.mocked(prisma.song.findFirst).mockResolvedValue(mockSongWithFullFile as never);
      vi.mocked(songService.updateSong).mockRejectedValue(new Error("Database error"));

      const res = await app.request("/api/songs/song-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated Title" }),
      });

      expect(res.status).toBe(500);
      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Failed to update song");
    });
  });

  describe("GET /api/songs/:id/playlist-count", () => {
    it("should return playlist count for song", async () => {
      const { prisma } = await import("../../lib/prisma");
      vi.mocked(prisma.song.findFirst).mockResolvedValue(mockSongWithFullFile as never);
      vi.mocked(songService.countPlaylistsWithSong).mockResolvedValue(3);

      const res = await app.request("/api/songs/song-1/playlist-count");
      expect(res.status).toBe(200);

      const json = (await res.json()) as ApiResponse<SongPlaylistCount>;
      expect(json.success).toBe(true);
      expect(json.data?.count).toBe(3);
    });

    it("should return 404 when song not found", async () => {
      const { prisma } = await import("../../lib/prisma");
      vi.mocked(prisma.song.findFirst).mockResolvedValue(null);

      const res = await app.request("/api/songs/nonexistent/playlist-count");
      expect(res.status).toBe(404);

      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Song not found");
    });

    it("should return 500 on service error", async () => {
      const { prisma } = await import("../../lib/prisma");
      vi.mocked(prisma.song.findFirst).mockResolvedValue(mockSongWithFullFile as never);
      vi.mocked(songService.countPlaylistsWithSong).mockRejectedValue(new Error("Database error"));

      const res = await app.request("/api/songs/song-1/playlist-count");
      expect(res.status).toBe(500);

      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Failed to get playlist count");
    });
  });

  describe("DELETE /api/songs/:id", () => {
    it("should delete song from library", async () => {
      vi.mocked(songService.verifySongInLibrary).mockResolvedValue(mockSongForVerify);
      vi.mocked(songService.getPlaylistsContainingSong).mockResolvedValue([]);
      vi.mocked(songService.deleteSong).mockResolvedValue([] as never);
      vi.mocked(songService.cleanupFileAfterSongDeletion).mockResolvedValue(undefined);

      const res = await app.request("/api/songs/song-1?libraryId=lib-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse<undefined>;
      expect(json.success).toBe(true);
      expect(songService.deleteSong).toHaveBeenCalledWith("song-1", "lib-1", []);
    });

    it("should return 400 when libraryId is missing", async () => {
      const res = await app.request("/api/songs/song-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("libraryId is required");
    });

    it("should return 404 when song not found in library", async () => {
      vi.mocked(songService.verifySongInLibrary).mockResolvedValue(null);

      const res = await app.request("/api/songs/song-1?libraryId=lib-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Song not found in this library");
    });

    it("should cleanup affected playlists", async () => {
      vi.mocked(songService.verifySongInLibrary).mockResolvedValue(mockSongForVerify);
      vi.mocked(songService.getPlaylistsContainingSong).mockResolvedValue(["playlist-1", "playlist-2"]);
      vi.mocked(songService.deleteSong).mockResolvedValue([] as never);
      vi.mocked(songService.cleanupFileAfterSongDeletion).mockResolvedValue(undefined);

      const res = await app.request("/api/songs/song-1?libraryId=lib-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      expect(songService.deleteSong).toHaveBeenCalledWith("song-1", "lib-1", ["playlist-1", "playlist-2"]);
    });

    it("should return 500 on service error", async () => {
      vi.mocked(songService.verifySongInLibrary).mockRejectedValue(new Error("Database error"));

      const res = await app.request("/api/songs/song-1?libraryId=lib-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Failed to delete song");
    });
  });

  // Note: GET /api/songs/:id/stream and GET /api/songs/:id/cover tests
  // are complex due to MinIO streaming. These would require integration tests
  // or more elaborate mocking of the MinIO client and ReadableStream.
});
