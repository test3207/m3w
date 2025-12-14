/**
 * Tests for offline-proxy player routes
 * These test the Guest mode player functionality backed by IndexedDB
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { RepeatMode } from "@m3w/shared";

// Mock the db module before importing routes
vi.mock("../../db/schema", () => ({
  db: {
    playerProgress: {
      get: vi.fn(),
      put: vi.fn(),
    },
    playerPreferences: {
      get: vi.fn(),
      put: vi.fn(),
    },
    songs: {
      get: vi.fn(),
    },
    playlists: {
      get: vi.fn(),
    },
    playlistSongs: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          first: vi.fn(),
        })),
      })),
    },
    libraries: {
      get: vi.fn(),
    },
  },
}));

// Mock utils
vi.mock("../utils", () => ({
  getUserId: vi.fn(() => "guest-user-id"),
  isGuestUser: vi.fn(() => true),
}));

// Import after mocks
import { playerRoutes } from "./player";
import { db } from "../../db/schema";

// Create app with player routes
const app = new Hono();
app.route("/player", playerRoutes);

// Mock data
const mockSong = {
  id: "song-1",
  title: "Test Song",
  artist: "Test Artist",
  album: "Test Album",
  coverUrl: "/covers/test.jpg",
  libraryId: "lib-1",
  mimeType: "audio/mpeg",
};

const mockProgress = {
  userId: "guest-user-id",
  songId: "song-1",
  position: 60,
  duration: 180,
  updatedAt: new Date("2024-01-01"),
};

const mockPreferences = {
  userId: "guest-user-id",
  shuffleEnabled: false,
  repeatMode: RepeatMode.Off,
  volume: 0.8,
  muted: false,
};

const mockLibrary = {
  id: "lib-1",
  name: "My Library",
  userId: "guest-user-id",
};

describe("Offline Player Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /player/progress", () => {
    it("should return null when no progress exists", async () => {
      vi.mocked(db.playerProgress.get).mockResolvedValue(undefined);

      const res = await app.request("/player/progress");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBeNull();
    });

    it("should return progress with song details", async () => {
      vi.mocked(db.playerProgress.get).mockResolvedValue(mockProgress);
      vi.mocked(db.songs.get).mockResolvedValue(mockSong);
      vi.mocked(db.playlistSongs.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      } as never);
      vi.mocked(db.libraries.get).mockResolvedValue(mockLibrary);

      const res = await app.request("/player/progress");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.track.title).toBe("Test Song");
      expect(json.data.position).toBe(60);
      expect(json.data.context.type).toBe("library");
    });

    it("should return null when song not found", async () => {
      vi.mocked(db.playerProgress.get).mockResolvedValue(mockProgress);
      vi.mocked(db.songs.get).mockResolvedValue(undefined);

      const res = await app.request("/player/progress");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBeNull();
    });
  });

  describe("PUT /player/progress", () => {
    it("should save playback progress", async () => {
      vi.mocked(db.songs.get).mockResolvedValue(mockSong);
      vi.mocked(db.playerProgress.put).mockResolvedValue("guest-user-id");

      const res = await app.request("/player/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songId: "song-1",
          position: 120,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.synced).toBe(true);

      expect(db.playerProgress.put).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "guest-user-id",
          songId: "song-1",
          position: 120,
        })
      );
    });

    it("should handle missing song gracefully", async () => {
      vi.mocked(db.songs.get).mockResolvedValue(undefined);
      vi.mocked(db.playerProgress.put).mockResolvedValue("guest-user-id");

      const res = await app.request("/player/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songId: "nonexistent",
          position: 60,
        }),
      });

      // Should still succeed with duration = 0
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe("GET /player/preferences", () => {
    it("should return preferences", async () => {
      vi.mocked(db.playerPreferences.get).mockResolvedValue(mockPreferences);

      const res = await app.request("/player/preferences");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.shuffleEnabled).toBe(false);
      expect(json.data.repeatMode).toBe(RepeatMode.Off);
      expect(json.data.volume).toBe(0.8);
    });

    it("should return default preferences when none exist", async () => {
      vi.mocked(db.playerPreferences.get).mockResolvedValue(undefined);

      const res = await app.request("/player/preferences");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.shuffleEnabled).toBe(false);
      expect(json.data.repeatMode).toBe(RepeatMode.Off);
      expect(json.data.volume).toBe(1);
      expect(json.data.muted).toBe(false);
    });
  });

  describe("PATCH /player/preferences", () => {
    it("should update shuffleEnabled preference", async () => {
      vi.mocked(db.playerPreferences.get).mockResolvedValue(mockPreferences);
      vi.mocked(db.playerPreferences.put).mockResolvedValue("guest-user-id");

      const res = await app.request("/player/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shuffleEnabled: true }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.updated).toBe(true);
    });

    it("should update repeatMode preference", async () => {
      vi.mocked(db.playerPreferences.get).mockResolvedValue(mockPreferences);
      vi.mocked(db.playerPreferences.put).mockResolvedValue("guest-user-id");

      const res = await app.request("/player/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repeatMode: RepeatMode.All }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.updated).toBe(true);
    });

    it("should update volume preference", async () => {
      vi.mocked(db.playerPreferences.get).mockResolvedValue(mockPreferences);
      vi.mocked(db.playerPreferences.put).mockResolvedValue("guest-user-id");

      const res = await app.request("/player/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volume: 0.5 }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.updated).toBe(true);
    });

    it("should merge with existing preferences", async () => {
      vi.mocked(db.playerPreferences.get).mockResolvedValue(mockPreferences);
      vi.mocked(db.playerPreferences.put).mockResolvedValue("guest-user-id");

      const res = await app.request("/player/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volume: 0.3 }),
      });

      expect(res.status).toBe(200);
      
      // Should merge with existing values
      expect(db.playerPreferences.put).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "guest-user-id",
          volume: 0.3,
          shuffleEnabled: false, // preserved from existing
          repeatMode: RepeatMode.Off, // preserved from existing
        })
      );
    });
  });
});
