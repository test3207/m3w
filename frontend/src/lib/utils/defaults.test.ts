/**
 * Default Resources Utilities Tests
 *
 * Tests for helper functions handling default library and favorites playlist
 */

import { describe, it, expect, vi } from "vitest";
import {
  getLibraryDisplayName,
  getPlaylistDisplayName,
  getLibraryBadge,
  getPlaylistBadge,
  canDeleteLibrary,
  canDeletePlaylist,
} from "./defaults";
import type { Library, Playlist } from "@m3w/shared";

// Mock the i18n module
vi.mock("@/locales/i18n", () => ({
  I18n: {
    defaults: {
      library: { badge: "Default" },
      playlist: { badge: "Favorites" },
    },
  },
}));

// Helper to create mock library
function createMockLibrary(overrides: Partial<Library> = {}): Library {
  return {
    id: "lib-1",
    name: "Test Library",
    description: null,
    userId: "user-1",
    songCount: 10,
    isDefault: false,
    canDelete: true,
    cacheOverride: "inherit",
    coverSongId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create mock playlist
function createMockPlaylist(overrides: Partial<Playlist> = {}): Playlist {
  return {
    id: "pl-1",
    name: "Test Playlist",
    description: null,
    userId: "user-1",
    songCount: 5,
    linkedLibraryId: null,
    isDefault: false,
    canDelete: true,
    coverSongId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Default Resources Utilities", () => {
  describe("getLibraryDisplayName", () => {
    it("should return the library name", () => {
      const library = createMockLibrary({ name: "My Music" });
      expect(getLibraryDisplayName(library)).toBe("My Music");
    });

    it("should return default library name (user can rename)", () => {
      const library = createMockLibrary({ name: "Default Library", isDefault: true });
      expect(getLibraryDisplayName(library)).toBe("Default Library");
    });

    it("should return renamed default library name", () => {
      const library = createMockLibrary({ name: "主音乐库", isDefault: true });
      expect(getLibraryDisplayName(library)).toBe("主音乐库");
    });
  });

  describe("getPlaylistDisplayName", () => {
    it("should return the playlist name", () => {
      const playlist = createMockPlaylist({ name: "Road Trip" });
      expect(getPlaylistDisplayName(playlist)).toBe("Road Trip");
    });

    it("should return favorites playlist name (user can rename)", () => {
      const playlist = createMockPlaylist({ name: "Favorites", isDefault: true });
      expect(getPlaylistDisplayName(playlist)).toBe("Favorites");
    });

    it("should return renamed favorites playlist name", () => {
      const playlist = createMockPlaylist({ name: "我的收藏", isDefault: true });
      expect(getPlaylistDisplayName(playlist)).toBe("我的收藏");
    });
  });

  describe("getLibraryBadge", () => {
    it("should return badge text for default library", () => {
      const library = createMockLibrary({ isDefault: true });
      expect(getLibraryBadge(library)).toBe("Default");
    });

    it("should return null for non-default library", () => {
      const library = createMockLibrary({ isDefault: false });
      expect(getLibraryBadge(library)).toBeNull();
    });
  });

  describe("getPlaylistBadge", () => {
    it("should return badge text for favorites playlist", () => {
      const playlist = createMockPlaylist({ isDefault: true });
      expect(getPlaylistBadge(playlist)).toBe("Favorites");
    });

    it("should return null for non-default playlist", () => {
      const playlist = createMockPlaylist({ isDefault: false });
      expect(getPlaylistBadge(playlist)).toBeNull();
    });
  });

  describe("canDeleteLibrary", () => {
    it("should return false for default library", () => {
      const library = createMockLibrary({ isDefault: true, canDelete: false });
      expect(canDeleteLibrary(library)).toBe(false);
    });

    it("should return true for non-default library with canDelete true", () => {
      const library = createMockLibrary({ isDefault: false, canDelete: true });
      expect(canDeleteLibrary(library)).toBe(true);
    });

    it("should return false for non-default library with canDelete false", () => {
      const library = createMockLibrary({ isDefault: false, canDelete: false });
      expect(canDeleteLibrary(library)).toBe(false);
    });

    it("should default canDelete to true when undefined", () => {
      const library = createMockLibrary({ isDefault: false });
      // @ts-expect-error - testing undefined case
      delete library.canDelete;
      expect(canDeleteLibrary(library)).toBe(true);
    });

    it("should prioritize isDefault check over canDelete", () => {
      // Even if canDelete is true, default library cannot be deleted
      const library = createMockLibrary({ isDefault: true, canDelete: true });
      expect(canDeleteLibrary(library)).toBe(false);
    });
  });

  describe("canDeletePlaylist", () => {
    it("should return false for favorites playlist", () => {
      const playlist = createMockPlaylist({ isDefault: true, canDelete: false });
      expect(canDeletePlaylist(playlist)).toBe(false);
    });

    it("should return true for non-default playlist with canDelete true", () => {
      const playlist = createMockPlaylist({ isDefault: false, canDelete: true });
      expect(canDeletePlaylist(playlist)).toBe(true);
    });

    it("should return false for non-default playlist with canDelete false", () => {
      const playlist = createMockPlaylist({ isDefault: false, canDelete: false });
      expect(canDeletePlaylist(playlist)).toBe(false);
    });

    it("should default canDelete to true when undefined", () => {
      const playlist = createMockPlaylist({ isDefault: false });
      // @ts-expect-error - testing undefined case
      delete playlist.canDelete;
      expect(canDeletePlaylist(playlist)).toBe(true);
    });

    it("should prioritize isDefault check over canDelete", () => {
      // Even if canDelete is true, favorites playlist cannot be deleted
      const playlist = createMockPlaylist({ isDefault: true, canDelete: true });
      expect(canDeletePlaylist(playlist)).toBe(false);
    });
  });
});
