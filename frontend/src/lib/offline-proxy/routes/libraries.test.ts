/**
 * Tests for offline-proxy library routes
 * These test the Guest mode library functionality backed by IndexedDB
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Mock the db module before importing routes
vi.mock("../../db/schema", () => ({
  db: {
    libraries: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          reverse: vi.fn(() => ({
            sortBy: vi.fn(),
          })),
          count: vi.fn(),
          toArray: vi.fn(),
          first: vi.fn(),
        })),
      })),
      get: vi.fn(),
      add: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
    songs: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(),
          count: vi.fn(),
          delete: vi.fn(),
          reverse: vi.fn(() => ({
            sortBy: vi.fn(),
          })),
        })),
      })),
    },
    playlists: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          modify: vi.fn(),
        })),
      })),
    },
  },
}));

// Mock utils
vi.mock("../utils", () => ({
  getUserId: vi.fn(() => "guest-user-id"),
  isGuestUser: vi.fn(() => true),
  sortSongsOffline: vi.fn((songs) => songs),
}));

// Mock other dependencies
vi.mock("../../utils/uuid", () => ({
  generateUUID: vi.fn(() => "new-lib-id"),
}));

vi.mock("../../utils/hash", () => ({
  calculateFileHash: vi.fn(),
}));

vi.mock("../../pwa/cache-manager", () => ({
  cacheAudioForOffline: vi.fn(),
  cacheCoverForOffline: vi.fn(),
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
import { libraryRoutes } from "./libraries";
import { db } from "../../db/schema";

// Create app with library routes
const app = new Hono();
app.route("/libraries", libraryRoutes);

// Mock data
const mockLibrary = {
  id: "lib-1",
  name: "My Library",
  description: null,
  userId: "guest-user-id",
  songCount: 5,
  isDefault: false,
  canDelete: true,
  cacheOverride: "inherit",
  coverSongId: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const mockDefaultLibrary = {
  ...mockLibrary,
  id: "default-lib",
  name: "Default Library",
  isDefault: true,
  canDelete: false,
};

describe("Offline Library Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /libraries", () => {
    it("should return all libraries for user", async () => {
      const libraries = [mockLibrary, mockDefaultLibrary];
      
      vi.mocked(db.libraries.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          reverse: vi.fn().mockReturnValue({
            sortBy: vi.fn().mockResolvedValue(libraries),
          }),
        }),
      } as never);

      vi.mocked(db.songs.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      } as never);

      const res = await app.request("/libraries");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
    });

    it("should include song counts", async () => {
      vi.mocked(db.libraries.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          reverse: vi.fn().mockReturnValue({
            sortBy: vi.fn().mockResolvedValue([mockLibrary]),
          }),
        }),
      } as never);

      const mockSongs = [
        { id: "song-1", libraryId: "lib-1", createdAt: "2024-01-01T00:00:00.000Z" },
        { id: "song-2", libraryId: "lib-1", createdAt: "2024-01-02T00:00:00.000Z" },
      ];

      vi.mocked(db.songs.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockSongs),
        }),
      } as never);

      const res = await app.request("/libraries");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data[0].songCount).toBe(2);
    });

    it("should use last song id as library coverSongId", async () => {
      vi.mocked(db.libraries.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          reverse: vi.fn().mockReturnValue({
            sortBy: vi.fn().mockResolvedValue([mockLibrary]),
          }),
        }),
      } as never);

      const mockSongs = [
        { id: "song-1", libraryId: "lib-1", createdAt: "2024-01-01T00:00:00.000Z" },
        { id: "song-2", libraryId: "lib-1", createdAt: "2024-01-02T00:00:00.000Z" },
      ];

      vi.mocked(db.songs.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockSongs),
        }),
      } as never);

      const res = await app.request("/libraries");
      expect(res.status).toBe(200);

      const json = await res.json();
      // Last song by date should be used for coverSongId
      expect(json.data[0].coverSongId).toBe("song-2");
    });
  });

  describe("GET /libraries/:id", () => {
    it("should return library by ID", async () => {
      vi.mocked(db.libraries.get).mockResolvedValue(mockLibrary);
      vi.mocked(db.songs.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(5),
          reverse: vi.fn().mockReturnValue({
            sortBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const res = await app.request("/libraries/lib-1");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe("lib-1");
      expect(json.data.name).toBe("My Library");
    });

    it("should return 404 when library not found", async () => {
      vi.mocked(db.libraries.get).mockResolvedValue(undefined);

      const res = await app.request("/libraries/nonexistent");
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Library not found");
    });
  });

  describe("POST /libraries", () => {
    it("should create new library", async () => {
      vi.mocked(db.libraries.add).mockResolvedValue("new-lib-id");

      const res = await app.request("/libraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Library" }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe("New Library");
      expect(json.data.id).toBe("new-lib-id");

      expect(db.libraries.add).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "new-lib-id",
          name: "New Library",
          userId: "guest-user-id",
          isDefault: false,
          canDelete: true,
        })
      );
    });

    it("should create library with description", async () => {
      vi.mocked(db.libraries.add).mockResolvedValue("new-lib-id");

      const res = await app.request("/libraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: "Work Music", 
          description: "Music for working" 
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.description).toBe("Music for working");
    });

    it("should return 500 on database error", async () => {
      vi.mocked(db.libraries.add).mockRejectedValue(new Error("Database error"));

      const res = await app.request("/libraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Library" }),
      });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe("PATCH /libraries/:id", () => {
    it("should update library name", async () => {
      vi.mocked(db.libraries.get).mockResolvedValue(mockLibrary);
      vi.mocked(db.libraries.put).mockResolvedValue("lib-1");

      const res = await app.request("/libraries/lib-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe("Updated Name");

      expect(db.libraries.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "lib-1",
          name: "Updated Name",
        })
      );
    });

    it("should update library description", async () => {
      vi.mocked(db.libraries.get).mockResolvedValue(mockLibrary);
      vi.mocked(db.libraries.put).mockResolvedValue("lib-1");

      const res = await app.request("/libraries/lib-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "New description" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.description).toBe("New description");
    });

    it("should return 404 for non-existent library", async () => {
      vi.mocked(db.libraries.get).mockResolvedValue(undefined);

      const res = await app.request("/libraries/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Library not found");
    });

    it("should return 404 for library owned by different user", async () => {
      vi.mocked(db.libraries.get).mockResolvedValue({
        ...mockLibrary,
        userId: "other-user-id",
      });

      const res = await app.request("/libraries/lib-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /libraries/:id", () => {
    it("should delete library and cascade songs", async () => {
      vi.mocked(db.libraries.get).mockResolvedValue(mockLibrary);
      vi.mocked(db.libraries.delete).mockResolvedValue(undefined);
      
      const mockSongsWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          delete: vi.fn().mockResolvedValue(5),
          toArray: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
          reverse: vi.fn().mockReturnValue({
            sortBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      vi.mocked(db.songs.where).mockImplementation(mockSongsWhere);

      const mockPlaylistsWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          modify: vi.fn().mockResolvedValue(1),
        }),
      });
      vi.mocked(db.playlists.where).mockImplementation(mockPlaylistsWhere);

      const res = await app.request("/libraries/lib-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      expect(db.libraries.delete).toHaveBeenCalledWith("lib-1");
    });

    it("should return 404 for non-existent library", async () => {
      vi.mocked(db.libraries.get).mockResolvedValue(undefined);

      const res = await app.request("/libraries/nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Library not found");
    });

    it("should return 404 for library owned by different user", async () => {
      vi.mocked(db.libraries.get).mockResolvedValue({
        ...mockLibrary,
        userId: "other-user-id",
      });

      const res = await app.request("/libraries/lib-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
