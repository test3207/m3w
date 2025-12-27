import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import playerRoutes from "../../routes/player";
import * as playerService from "../../services/player.service";
import type { PlaybackSeedResponse, PlaybackPreferences, PlaybackProgressResponse } from "../../services/player.service";
import { RepeatMode } from "@m3w/shared";

// Helper type for API response
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Mock services
vi.mock("../../services/player.service", () => ({
  getPlaybackSeed: vi.fn(),
  getPlaybackPreferences: vi.fn(),
  updatePlaybackPreferences: vi.fn(),
  getPlaybackProgress: vi.fn(),
  updatePlaybackProgress: vi.fn(),
  normalizeRepeatMode: vi.fn((v) => v || RepeatMode.Off),
  mapPlaybackContext: vi.fn((type, id, name) => (type && id ? { type, id, name } : null)),
}));

// Mock auth middleware
vi.mock("../../lib/auth-middleware", () => ({
  authMiddleware: vi.fn(async (c, next) => {
    c.set("auth", { userId: "test-user-id", email: "test@example.com" });
    await next();
  }),
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

// Create app with player routes
const app = new Hono();
app.route("/api/player", playerRoutes);

describe("Player Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/player/seed", () => {
    it("should return playback seed when available", async () => {
      const mockSeed: PlaybackSeedResponse = {
        track: {
          id: "song-1",
          title: "Test Song",
          artist: "Test Artist",
          album: "Test Album",
          duration: 180,
        },
        context: {
          type: "playlist",
          id: "playlist-1",
          name: "My Playlist",
        },
      };

      vi.mocked(playerService.getPlaybackSeed).mockResolvedValue(mockSeed);

      const res = await app.request("/api/player/seed");
      expect(res.status).toBe(200);

      const json = await res.json() as ApiResponse<PlaybackSeedResponse>;
      expect(json.success).toBe(true);
      expect(json.data).toEqual(mockSeed);
      expect(playerService.getPlaybackSeed).toHaveBeenCalledWith("test-user-id");
    });

    it("should return null when no seed available", async () => {
      vi.mocked(playerService.getPlaybackSeed).mockResolvedValue(null);

      const res = await app.request("/api/player/seed");
      expect(res.status).toBe(200);

      const json = await res.json() as ApiResponse<PlaybackSeedResponse | null>;
      expect(json.success).toBe(true);
      expect(json.data).toBeNull();
    });

    it("should return 500 on service error", async () => {
      vi.mocked(playerService.getPlaybackSeed).mockRejectedValue(
        new Error("Database error")
      );

      const res = await app.request("/api/player/seed");
      expect(res.status).toBe(500);

      const json = await res.json() as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Failed to seed playback");
    });
  });

  describe("GET /api/player/preferences", () => {
    it("should return playback preferences", async () => {
      const mockPrefs: PlaybackPreferences = {
        shuffleEnabled: true,
        repeatMode: RepeatMode.All,
      };

      vi.mocked(playerService.getPlaybackPreferences).mockResolvedValue(mockPrefs);

      const res = await app.request("/api/player/preferences");
      expect(res.status).toBe(200);

      const json = await res.json() as ApiResponse<PlaybackPreferences>;
      expect(json.success).toBe(true);
      expect(json.data).toEqual(mockPrefs);
      expect(playerService.getPlaybackPreferences).toHaveBeenCalledWith("test-user-id");
    });

    it("should return 500 on service error", async () => {
      vi.mocked(playerService.getPlaybackPreferences).mockRejectedValue(
        new Error("Database error")
      );

      const res = await app.request("/api/player/preferences");
      expect(res.status).toBe(500);

      const json = await res.json() as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Failed to retrieve playback preferences");
    });
  });

  describe("PUT /api/player/preferences", () => {
    it("should update shuffle preference", async () => {
      const updatedPrefs: PlaybackPreferences = { shuffleEnabled: true, repeatMode: RepeatMode.Off };
      vi.mocked(playerService.updatePlaybackPreferences).mockResolvedValue(updatedPrefs);

      const res = await app.request("/api/player/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shuffleEnabled: true }),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as ApiResponse<PlaybackPreferences>;
      expect(json.success).toBe(true);
      expect(json.data).toEqual(updatedPrefs);
      expect(playerService.updatePlaybackPreferences).toHaveBeenCalledWith(
        "test-user-id",
        { shuffleEnabled: true }
      );
    });

    it("should update repeat mode", async () => {
      const updatedPrefs: PlaybackPreferences = { shuffleEnabled: false, repeatMode: RepeatMode.One };
      vi.mocked(playerService.updatePlaybackPreferences).mockResolvedValue(updatedPrefs);

      const res = await app.request("/api/player/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repeatMode: "one" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as ApiResponse<PlaybackPreferences>;
      expect(json.success).toBe(true);
      expect(json.data?.repeatMode).toBe(RepeatMode.One);
    });

    it("should return 400 for invalid repeat mode", async () => {
      const res = await app.request("/api/player/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repeatMode: "invalid" }),
      });

      expect(res.status).toBe(400);
      const json = await res.json() as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Invalid input");
    });

    it("should return 400 when no fields provided", async () => {
      const res = await app.request("/api/player/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const json = await res.json() as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Invalid input");
    });

    it("should return 400 for invalid JSON", async () => {
      const res = await app.request("/api/player/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json",
      });

      expect(res.status).toBe(400);
      const json = await res.json() as ApiResponse;
      expect(json.success).toBe(false);
    });

    it("should return 500 on service error", async () => {
      vi.mocked(playerService.updatePlaybackPreferences).mockRejectedValue(
        new Error("Database error")
      );

      const res = await app.request("/api/player/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shuffleEnabled: true }),
      });

      expect(res.status).toBe(500);
      const json = await res.json() as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Failed to update playback preferences");
    });
  });

  describe("GET /api/player/progress", () => {
    it("should return playback progress", async () => {
      const mockProgress: PlaybackProgressResponse = {
        track: {
          id: "song-1",
          title: "Test Song",
          artist: "Test Artist",
          album: "Test Album",
          duration: 180,
        },
        position: 45,
        context: { type: "library", id: "lib-1", name: "My Library" },
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      vi.mocked(playerService.getPlaybackProgress).mockResolvedValue(mockProgress);

      const res = await app.request("/api/player/progress");
      expect(res.status).toBe(200);

      const json = await res.json() as ApiResponse<PlaybackProgressResponse>;
      expect(json.success).toBe(true);
      expect(json.data).toEqual(mockProgress);
      expect(playerService.getPlaybackProgress).toHaveBeenCalledWith("test-user-id");
    });

    it("should return null when no progress", async () => {
      vi.mocked(playerService.getPlaybackProgress).mockResolvedValue(null);

      const res = await app.request("/api/player/progress");
      expect(res.status).toBe(200);

      const json = await res.json() as ApiResponse<PlaybackProgressResponse | null>;
      expect(json.success).toBe(true);
      expect(json.data).toBeNull();
    });

    it("should return 500 on service error", async () => {
      vi.mocked(playerService.getPlaybackProgress).mockRejectedValue(
        new Error("Database error")
      );

      const res = await app.request("/api/player/progress");
      expect(res.status).toBe(500);

      const json = await res.json() as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Failed to retrieve playback progress");
    });
  });

  describe("PUT /api/player/progress", () => {
    it("should update playback progress", async () => {
      vi.mocked(playerService.updatePlaybackProgress).mockResolvedValue(true);

      const res = await app.request("/api/player/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songId: "song-1",
          position: 120,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as ApiResponse;
      expect(json.success).toBe(true);
      expect(playerService.updatePlaybackProgress).toHaveBeenCalledWith(
        "test-user-id",
        { songId: "song-1", position: 120 }
      );
    });

    it("should update progress with context", async () => {
      vi.mocked(playerService.updatePlaybackProgress).mockResolvedValue(true);

      const res = await app.request("/api/player/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songId: "song-1",
          position: 60,
          contextType: "playlist",
          contextId: "playlist-1",
          contextName: "My Playlist",
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as ApiResponse;
      expect(json.success).toBe(true);
    });

    it("should return 400 when songId is missing", async () => {
      const res = await app.request("/api/player/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: 120 }),
      });

      expect(res.status).toBe(400);
      const json = await res.json() as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Invalid input");
    });

    it("should return 400 when position is negative", async () => {
      const res = await app.request("/api/player/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: "song-1", position: -1 }),
      });

      expect(res.status).toBe(400);
      const json = await res.json() as ApiResponse;
      expect(json.success).toBe(false);
    });

    it("should return 400 when position exceeds max (86400)", async () => {
      const res = await app.request("/api/player/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: "song-1", position: 100000 }),
      });

      expect(res.status).toBe(400);
      const json = await res.json() as ApiResponse;
      expect(json.success).toBe(false);
    });

    it("should return 400 when contextType provided without contextId", async () => {
      const res = await app.request("/api/player/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songId: "song-1",
          position: 60,
          contextType: "playlist",
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json() as ApiResponse;
      expect(json.success).toBe(false);
    });

    it("should return 404 when song not found", async () => {
      vi.mocked(playerService.updatePlaybackProgress).mockResolvedValue(false);

      const res = await app.request("/api/player/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: "nonexistent", position: 60 }),
      });

      expect(res.status).toBe(404);
      const json = await res.json() as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Song not found");
    });

    it("should return 400 for invalid JSON", async () => {
      const res = await app.request("/api/player/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      });

      expect(res.status).toBe(400);
      const json = await res.json() as ApiResponse;
      expect(json.success).toBe(false);
    });

    it("should return 500 on service error", async () => {
      vi.mocked(playerService.updatePlaybackProgress).mockRejectedValue(
        new Error("Database error")
      );

      const res = await app.request("/api/player/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: "song-1", position: 60 }),
      });

      expect(res.status).toBe(500);
      const json = await res.json() as ApiResponse;
      expect(json.success).toBe(false);
      expect(json.error).toBe("Failed to update playback progress");
    });
  });
});
