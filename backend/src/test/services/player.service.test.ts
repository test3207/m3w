/**
 * Tests for player service
 * Tests pure helper functions for playback
 */

import { describe, it, expect } from "vitest";
import { RepeatMode } from "@m3w/shared";

import {
  normalizeRepeatMode,
  mapPlaybackContext,
} from "../../services/player.service";

describe("Player Service", () => {
  describe("normalizeRepeatMode", () => {
    it("should return Off for null", () => {
      expect(normalizeRepeatMode(null)).toBe(RepeatMode.Off);
    });

    it("should return Off for undefined", () => {
      expect(normalizeRepeatMode(undefined)).toBe(RepeatMode.Off);
    });

    it("should return Off for invalid string", () => {
      expect(normalizeRepeatMode("invalid")).toBe(RepeatMode.Off);
    });

    it("should return Off for empty string", () => {
      expect(normalizeRepeatMode("")).toBe(RepeatMode.Off);
    });

    it("should return valid repeat mode All", () => {
      expect(normalizeRepeatMode(RepeatMode.All)).toBe(RepeatMode.All);
    });

    it("should return valid repeat mode One", () => {
      expect(normalizeRepeatMode(RepeatMode.One)).toBe(RepeatMode.One);
    });

    it("should return valid repeat mode Off", () => {
      expect(normalizeRepeatMode(RepeatMode.Off)).toBe(RepeatMode.Off);
    });
  });

  describe("mapPlaybackContext", () => {
    it("should return null for null type", () => {
      expect(mapPlaybackContext(null, "id", "name")).toBeNull();
    });

    it("should return null for undefined type", () => {
      expect(mapPlaybackContext(undefined, "id", "name")).toBeNull();
    });

    it("should return null for invalid type", () => {
      expect(mapPlaybackContext("invalid", "id", "name")).toBeNull();
    });

    it("should return null for null id", () => {
      expect(mapPlaybackContext("library", null, "name")).toBeNull();
    });

    it("should return null for undefined id", () => {
      expect(mapPlaybackContext("library", undefined, "name")).toBeNull();
    });

    it("should return valid context for library", () => {
      const context = mapPlaybackContext("library", "lib-1", "My Library");
      expect(context).toEqual({
        type: "library",
        id: "lib-1",
        name: "My Library",
      });
    });

    it("should return valid context for playlist", () => {
      const context = mapPlaybackContext("playlist", "pl-1", "My Playlist");
      expect(context).toEqual({
        type: "playlist",
        id: "pl-1",
        name: "My Playlist",
      });
    });

    it("should return valid context for album", () => {
      const context = mapPlaybackContext("album", "album-1", "My Album");
      expect(context).toEqual({
        type: "album",
        id: "album-1",
        name: "My Album",
      });
    });

    it("should return valid context for search", () => {
      const context = mapPlaybackContext("search", "query-1", "Search Query");
      expect(context).toEqual({
        type: "search",
        id: "query-1",
        name: "Search Query",
      });
    });

    it("should return valid context for queue", () => {
      const context = mapPlaybackContext("queue", "q-1", "Custom Queue");
      expect(context).toEqual({
        type: "queue",
        id: "q-1",
        name: "Custom Queue",
      });
    });

    it("should return context with null name", () => {
      const context = mapPlaybackContext("library", "lib-1", null);
      expect(context).toEqual({
        type: "library",
        id: "lib-1",
        name: null,
      });
    });

    it("should return context with undefined name converted to null", () => {
      const context = mapPlaybackContext("library", "lib-1", undefined);
      expect(context).toEqual({
        type: "library",
        id: "lib-1",
        name: null,
      });
    });
  });
});
