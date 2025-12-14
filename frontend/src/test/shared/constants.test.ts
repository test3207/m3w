/**
 * Shared Package - Constants Tests
 *
 * Tests for default resource helper functions
 */

import { describe, it, expect } from "vitest";
import {
  isDefaultLibrary,
  isFavoritesPlaylist,
} from "@m3w/shared";

describe("Constants", () => {
  describe("isDefaultLibrary", () => {
    it("should return true when isDefault is true", () => {
      const library = { isDefault: true };
      expect(isDefaultLibrary(library)).toBe(true);
    });

    it("should return false when isDefault is false", () => {
      const library = { isDefault: false };
      expect(isDefaultLibrary(library)).toBe(false);
    });

    it("should return false when isDefault is undefined", () => {
      const library = {};
      expect(isDefaultLibrary(library)).toBe(false);
    });

    it("should work with full library object", () => {
      const library = {
        id: "lib-1",
        name: "Default Library",
        isDefault: true,
        canDelete: false,
        songCount: 10,
      };
      expect(isDefaultLibrary(library)).toBe(true);
    });

    it("should return false for user-created library", () => {
      const library = {
        id: "lib-2",
        name: "My Music",
        isDefault: false,
        canDelete: true,
        songCount: 50,
      };
      expect(isDefaultLibrary(library)).toBe(false);
    });
  });

  describe("isFavoritesPlaylist", () => {
    it("should return true when isDefault is true", () => {
      const playlist = { isDefault: true };
      expect(isFavoritesPlaylist(playlist)).toBe(true);
    });

    it("should return false when isDefault is false", () => {
      const playlist = { isDefault: false };
      expect(isFavoritesPlaylist(playlist)).toBe(false);
    });

    it("should return false when isDefault is undefined", () => {
      const playlist = {};
      expect(isFavoritesPlaylist(playlist)).toBe(false);
    });

    it("should work with full playlist object", () => {
      const playlist = {
        id: "pl-1",
        name: "Favorites",
        isDefault: true,
        canDelete: false,
        songCount: 25,
      };
      expect(isFavoritesPlaylist(playlist)).toBe(true);
    });

    it("should return false for user-created playlist", () => {
      const playlist = {
        id: "pl-2",
        name: "Road Trip",
        isDefault: false,
        canDelete: true,
        songCount: 15,
      };
      expect(isFavoritesPlaylist(playlist)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle objects with extra properties", () => {
      const library = {
        isDefault: true,
        extraProp: "ignored",
        nested: { data: "also ignored" },
      };
      expect(isDefaultLibrary(library)).toBe(true);
    });

    it("should not coerce truthy values to true", () => {
      const library = { isDefault: 1 } as unknown as { isDefault?: boolean };
      expect(isDefaultLibrary(library)).toBe(false);
    });

    it("should not coerce truthy string to true", () => {
      const library = { isDefault: "true" } as unknown as { isDefault?: boolean };
      expect(isDefaultLibrary(library)).toBe(false);
    });
  });
});
