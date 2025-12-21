/**
 * Tests for offline-proxy playlist routes
 * These test the Guest mode playlist functionality backed by IndexedDB
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Mock playlist service
vi.mock("../services/playlist.service", () => ({
  getUserPlaylistsWithCovers: vi.fn(),
  getPlaylistById: vi.fn(),
  getPlaylistByLibraryId: vi.fn(),
  createPlaylist: vi.fn(),
  updatePlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
  getPlaylistSongs: vi.fn(),
  addSongToPlaylist: vi.fn(),
  reorderPlaylistSongs: vi.fn(),
  replacePlaylistSongs: vi.fn(),
  removeSongFromPlaylist: vi.fn(),
}));

// Mock utils
vi.mock("../utils", () => ({
  getUserId: vi.fn(() => "guest-user-id"),
  isGuestUser: vi.fn(() => true),
}));

vi.mock("../../logger-client", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks
import { playlistRoutes } from "./playlists";
import {
  getUserPlaylistsWithCovers,
  getPlaylistById,
  getPlaylistByLibraryId,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  getPlaylistSongs,
  addSongToPlaylist,
  reorderPlaylistSongs,
  replacePlaylistSongs,
  removeSongFromPlaylist,
} from "../services/playlist.service";

// Create app with playlist routes
const app = new Hono();
app.route("/playlists", playlistRoutes);

// Mock data
const mockPlaylist = {
  id: "playlist-1",
  name: "My Playlist",
  description: null,
  userId: "guest-user-id",
  songCount: 5,
  isDefault: false,
  canDelete: true,
  linkedLibraryId: null,
  coverSongId: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const mockSong = {
  id: "song-1",
  title: "Test Song",
  artist: "Test Artist",
  album: "Test Album",
  albumArtist: "Test Album Artist",
  composer: "Test Composer",
  duration: 180,
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

describe("Offline Playlist Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /playlists", () => {
    it("should return all playlists for user", async () => {
      vi.mocked(getUserPlaylistsWithCovers).mockResolvedValue([mockPlaylist]);

      const res = await app.request("/playlists");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].name).toBe("My Playlist");

      expect(getUserPlaylistsWithCovers).toHaveBeenCalledWith("guest-user-id");
    });

    it("should return empty array when no playlists", async () => {
      vi.mocked(getUserPlaylistsWithCovers).mockResolvedValue([]);

      const res = await app.request("/playlists");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(0);
    });

    it("should return 500 on error", async () => {
      vi.mocked(getUserPlaylistsWithCovers).mockRejectedValue(new Error("Database error"));

      const res = await app.request("/playlists");
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe("GET /playlists/:id", () => {
    it("should return playlist by ID", async () => {
      vi.mocked(getPlaylistById).mockResolvedValue(mockPlaylist);

      const res = await app.request("/playlists/playlist-1");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe("playlist-1");

      expect(getPlaylistById).toHaveBeenCalledWith("playlist-1", "guest-user-id");
    });

    it("should return 404 when playlist not found", async () => {
      vi.mocked(getPlaylistById).mockResolvedValue(null);

      const res = await app.request("/playlists/nonexistent");
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Playlist not found");
    });
  });

  describe("GET /playlists/by-library/:libraryId", () => {
    it("should return playlist linked to library", async () => {
      const linkedPlaylist = { ...mockPlaylist, linkedLibraryId: "lib-1" };
      vi.mocked(getPlaylistByLibraryId).mockResolvedValue(linkedPlaylist);

      const res = await app.request("/playlists/by-library/lib-1");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.linkedLibraryId).toBe("lib-1");

      expect(getPlaylistByLibraryId).toHaveBeenCalledWith("lib-1", "guest-user-id");
    });

    it("should return null when no linked playlist", async () => {
      vi.mocked(getPlaylistByLibraryId).mockResolvedValue(null);

      const res = await app.request("/playlists/by-library/lib-1");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBeNull();
    });
  });

  describe("POST /playlists", () => {
    it("should create new playlist", async () => {
      vi.mocked(createPlaylist).mockResolvedValue(mockPlaylist);

      const res = await app.request("/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Playlist" }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);

      expect(createPlaylist).toHaveBeenCalledWith(
        "guest-user-id",
        expect.objectContaining({ name: "New Playlist" })
      );
    });

    it("should create playlist with description", async () => {
      vi.mocked(createPlaylist).mockResolvedValue({
        ...mockPlaylist,
        description: "A great playlist",
      });

      const res = await app.request("/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Playlist", description: "A great playlist" }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe("PATCH /playlists/:id", () => {
    it("should update playlist name", async () => {
      vi.mocked(updatePlaylist).mockResolvedValue({
        ...mockPlaylist,
        name: "Updated Name",
      });

      const res = await app.request("/playlists/playlist-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      expect(updatePlaylist).toHaveBeenCalledWith(
        "playlist-1",
        "guest-user-id",
        expect.objectContaining({ name: "Updated Name" })
      );
    });

    it("should return 404 when playlist not found", async () => {
      vi.mocked(updatePlaylist).mockResolvedValue(null);

      const res = await app.request("/playlists/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /playlists/:id", () => {
    it("should delete playlist", async () => {
      vi.mocked(deletePlaylist).mockResolvedValue(true);

      const res = await app.request("/playlists/playlist-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      expect(deletePlaylist).toHaveBeenCalledWith("playlist-1", "guest-user-id");
    });

    it("should return 404 when playlist not found", async () => {
      vi.mocked(deletePlaylist).mockResolvedValue(false);

      const res = await app.request("/playlists/nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /playlists/:id/songs", () => {
    it("should return songs in playlist", async () => {
      vi.mocked(getPlaylistSongs).mockResolvedValue([mockSong]);

      const res = await app.request("/playlists/playlist-1/songs");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].title).toBe("Test Song");

      expect(getPlaylistSongs).toHaveBeenCalledWith("playlist-1", "guest-user-id");
    });

    it("should return 404 when playlist not found", async () => {
      vi.mocked(getPlaylistSongs).mockResolvedValue(null);

      const res = await app.request("/playlists/nonexistent/songs");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /playlists/:id/songs", () => {
    it("should add song to playlist", async () => {
      vi.mocked(addSongToPlaylist).mockResolvedValue({
        success: true,
        data: { playlistId: "playlist-1", songId: "song-1", newSongCount: 6 },
      });

      const res = await app.request("/playlists/playlist-1/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: "song-1" }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);

      expect(addSongToPlaylist).toHaveBeenCalledWith("playlist-1", "song-1", "guest-user-id");
    });

    it("should return 404 when playlist not found", async () => {
      vi.mocked(addSongToPlaylist).mockResolvedValue({
        success: false,
        error: "Playlist not found",
      });

      const res = await app.request("/playlists/nonexistent/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: "song-1" }),
      });

      expect(res.status).toBe(404);
    });

    it("should return 400 when song already in playlist", async () => {
      vi.mocked(addSongToPlaylist).mockResolvedValue({
        success: false,
        error: "Song already in playlist",
      });

      const res = await app.request("/playlists/playlist-1/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: "song-1" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("PUT /playlists/:id/songs/reorder", () => {
    it("should reorder songs in playlist", async () => {
      vi.mocked(reorderPlaylistSongs).mockResolvedValue({
        success: true,
        data: { playlistId: "playlist-1", songCount: 3, updatedAt: "2024-01-02T00:00:00.000Z" },
      });

      const res = await app.request("/playlists/playlist-1/songs/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songIds: ["song-3", "song-1", "song-2"] }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.songCount).toBe(3);

      expect(reorderPlaylistSongs).toHaveBeenCalledWith(
        "playlist-1",
        ["song-3", "song-1", "song-2"],
        "guest-user-id"
      );
    });

    it("should return 404 when playlist not found", async () => {
      vi.mocked(reorderPlaylistSongs).mockResolvedValue({
        success: false,
        error: "Playlist not found",
      });

      const res = await app.request("/playlists/nonexistent/songs/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songIds: ["song-1", "song-2"] }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /playlists/:id/songs", () => {
    it("should replace playlist songs", async () => {
      vi.mocked(replacePlaylistSongs).mockResolvedValue(true);

      const res = await app.request("/playlists/playlist-1/songs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songIds: ["song-1", "song-2", "song-3"] }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      expect(replacePlaylistSongs).toHaveBeenCalledWith(
        "playlist-1",
        ["song-1", "song-2", "song-3"],
        "guest-user-id"
      );
    });

    it("should return 404 when playlist not found", async () => {
      vi.mocked(replacePlaylistSongs).mockResolvedValue(false);

      const res = await app.request("/playlists/nonexistent/songs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songIds: ["song-1"] }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /playlists/:id/songs/:songId", () => {
    it("should remove song from playlist", async () => {
      vi.mocked(removeSongFromPlaylist).mockResolvedValue({
        success: true,
        data: { playlistId: "playlist-1", songId: "song-1", newSongCount: 4 },
      });

      const res = await app.request("/playlists/playlist-1/songs/song-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.songId).toBe("song-1");

      expect(removeSongFromPlaylist).toHaveBeenCalledWith(
        "playlist-1",
        "song-1",
        "guest-user-id"
      );
    });

    it("should return 404 when song not in playlist", async () => {
      vi.mocked(removeSongFromPlaylist).mockResolvedValue({
        success: false,
        error: "Song not in playlist",
      });

      const res = await app.request("/playlists/playlist-1/songs/song-99", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
