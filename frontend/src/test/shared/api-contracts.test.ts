/**
 * API Contracts tests
 * 
 * Tests for @m3w/shared api-contracts module
 */

import { describe, it, expect } from "vitest";
import {
  userDataRoutes,
  adminRoutes,
  allRoutes,
  isOfflineCapable,
  getCacheConfig,
  extractParams,
} from "@m3w/shared";

describe("api-contracts", () => {
  describe("route definitions", () => {
    describe("userDataRoutes", () => {
      it("should have library routes", () => {
        const libraryRoutes = userDataRoutes.filter((r) =>
          r.path.includes("/libraries")
        );
        expect(libraryRoutes.length).toBeGreaterThan(0);
      });

      it("should have playlist routes", () => {
        const playlistRoutes = userDataRoutes.filter((r) =>
          r.path.includes("/playlists")
        );
        expect(playlistRoutes.length).toBeGreaterThan(0);
      });

      it("should have song routes", () => {
        const songRoutes = userDataRoutes.filter((r) =>
          r.path.includes("/songs")
        );
        expect(songRoutes.length).toBeGreaterThan(0);
      });

      it("should all be offline capable", () => {
        userDataRoutes.forEach((route) => {
          expect(route.offlineCapable).toBe(true);
        });
      });

      it("should have descriptions", () => {
        userDataRoutes.forEach((route) => {
          expect(route.description).toBeTruthy();
        });
      });
    });

    describe("adminRoutes", () => {
      it("should have auth routes", () => {
        const authRoutes = adminRoutes.filter((r) => r.path.includes("/auth"));
        expect(authRoutes.length).toBeGreaterThan(0);
      });

      it("should have health check routes", () => {
        const healthRoute = adminRoutes.find((r) => r.path === "/health");
        const readyRoute = adminRoutes.find((r) => r.path === "/ready");
        expect(healthRoute).toBeDefined();
        expect(healthRoute?.offlineCapable).toBe(false);
        expect(readyRoute).toBeDefined();
        expect(readyRoute?.offlineCapable).toBe(false);
      });

      it("should have user management routes", () => {
        const userRoutes = adminRoutes.filter((r) => r.path.includes("/users"));
        expect(userRoutes.length).toBeGreaterThan(0);
      });

      it("should have player routes", () => {
        const playerRoutes = adminRoutes.filter((r) =>
          r.path.includes("/player")
        );
        expect(playerRoutes.length).toBeGreaterThan(0);
      });
    });

    describe("allRoutes", () => {
      it("should combine userDataRoutes and adminRoutes", () => {
        expect(allRoutes.length).toBe(
          userDataRoutes.length + adminRoutes.length
        );
      });

      it("should have valid HTTP methods", () => {
        const validMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
        allRoutes.forEach((route) => {
          expect(validMethods).toContain(route.method);
        });
      });

      it("should have paths starting with /api or / for health checks", () => {
        allRoutes.forEach((route) => {
          const isHealthCheck = route.path === "/health" || route.path === "/ready";
          expect(route.path.startsWith("/api") || isHealthCheck).toBe(true);
        });
      });
    });
  });

  describe("isOfflineCapable", () => {
    it("should return true for offline capable routes", () => {
      expect(isOfflineCapable("/api/libraries", "GET")).toBe(true);
      expect(isOfflineCapable("/api/playlists", "GET")).toBe(true);
      expect(isOfflineCapable("/api/songs/123", "GET")).toBe(true);
    });

    it("should return false for online-only routes", () => {
      expect(isOfflineCapable("/health", "GET")).toBe(false);
      expect(isOfflineCapable("/ready", "GET")).toBe(false);
      expect(isOfflineCapable("/api/auth/login", "POST")).toBe(false);
      expect(isOfflineCapable("/api/auth/me", "GET")).toBe(false);
    });

    it("should return false for unknown routes", () => {
      expect(isOfflineCapable("/api/unknown", "GET")).toBe(false);
      expect(isOfflineCapable("/api/nonexistent/route", "POST")).toBe(false);
    });

    it("should handle parametrized routes", () => {
      expect(isOfflineCapable("/api/libraries/lib-123", "GET")).toBe(true);
      expect(isOfflineCapable("/api/playlists/pl-456", "DELETE")).toBe(true);
      expect(isOfflineCapable("/api/songs/song-789/stream", "GET")).toBe(true);
    });

    it("should be case-sensitive for methods", () => {
      // Routes are defined with uppercase methods
      expect(isOfflineCapable("/api/libraries", "GET")).toBe(true);
      // Lowercase would not match
      expect(isOfflineCapable("/api/libraries", "get")).toBe(false);
    });
  });

  describe("getCacheConfig", () => {
    it("should return cache config for cacheable GET routes", () => {
      const result = getCacheConfig("/api/libraries", "GET");

      expect(result).toBeDefined();
      expect(result!.config.table).toBe("libraries");
      expect(result!.config.strategy).toBe("replace-all");
    });

    it("should return undefined for non-GET routes", () => {
      expect(getCacheConfig("/api/libraries", "POST")).toBeUndefined();
      expect(getCacheConfig("/api/playlists", "DELETE")).toBeUndefined();
    });

    it("should return undefined for routes without cache config", () => {
      expect(getCacheConfig("/health", "GET")).toBeUndefined();
      expect(getCacheConfig("/api/auth/me", "GET")).toBeUndefined();
    });

    it("should extract params from parametrized routes", () => {
      const result = getCacheConfig("/api/libraries/lib-123", "GET");

      expect(result).toBeDefined();
      expect(result!.params.id).toBe("lib-123");
    });

    it("should handle upsert strategy", () => {
      const result = getCacheConfig("/api/libraries/lib-123", "GET");

      expect(result).toBeDefined();
      expect(result!.config.strategy).toBe("upsert");
    });

    it("should handle replace-by-key strategy with keyParam", () => {
      const result = getCacheConfig("/api/libraries/lib-123/songs", "GET");

      expect(result).toBeDefined();
      expect(result!.config.strategy).toBe("replace-by-key");
      if (result!.config.strategy === "replace-by-key") {
        expect(result!.config.keyParam).toBe("id");
      }
    });

    it("should handle playlist songs with updateJoinTable flag", () => {
      const result = getCacheConfig("/api/playlists/pl-123/songs", "GET");

      expect(result).toBeDefined();
      expect(result!.config.strategy).toBe("replace-by-key");
      if (result!.config.strategy === "replace-by-key") {
        expect(result!.config.updateJoinTable).toBe(true);
      }
    });
  });

  describe("extractParams", () => {
    it("should extract single parameter", () => {
      const params = extractParams("/api/libraries/:id", "/api/libraries/lib-123");

      expect(params).toEqual({ id: "lib-123" });
    });

    it("should extract multiple parameters", () => {
      const params = extractParams(
        "/api/playlists/:id/songs/:songId",
        "/api/playlists/pl-123/songs/song-456"
      );

      expect(params).toEqual({ id: "pl-123", songId: "song-456" });
    });

    it("should return empty object for routes without parameters", () => {
      const params = extractParams("/api/libraries", "/api/libraries");

      expect(params).toEqual({});
    });

    it("should handle nested parameters", () => {
      const params = extractParams(
        "/api/playlists/by-library/:libraryId",
        "/api/playlists/by-library/lib-789"
      );

      expect(params).toEqual({ libraryId: "lib-789" });
    });

    it("should handle UUID-like parameters", () => {
      const params = extractParams(
        "/api/songs/:id",
        "/api/songs/550e8400-e29b-41d4-a716-446655440000"
      );

      expect(params).toEqual({ id: "550e8400-e29b-41d4-a716-446655440000" });
    });

    it("should handle parameters with special characters", () => {
      const params = extractParams(
        "/api/libraries/:id",
        "/api/libraries/test_lib-123"
      );

      expect(params).toEqual({ id: "test_lib-123" });
    });
  });

  describe("route coverage", () => {
    it("should have GET route for libraries list", () => {
      const route = allRoutes.find(
        (r) => r.path === "/api/libraries" && r.method === "GET"
      );
      expect(route).toBeDefined();
      expect(route?.offlineCapable).toBe(true);
    });

    it("should have POST route for creating libraries", () => {
      const route = allRoutes.find(
        (r) => r.path === "/api/libraries" && r.method === "POST"
      );
      expect(route).toBeDefined();
    });

    it("should have DELETE route for songs in playlists", () => {
      const route = allRoutes.find(
        (r) =>
          r.path === "/api/playlists/:id/songs/:songId" && r.method === "DELETE"
      );
      expect(route).toBeDefined();
    });

    it("should have audio streaming route", () => {
      const route = allRoutes.find(
        (r) => r.path === "/api/songs/:id/stream" && r.method === "GET"
      );
      expect(route).toBeDefined();
      expect(route?.offlineCapable).toBe(true);
    });

    it("should have player preference routes", () => {
      const getRoute = allRoutes.find(
        (r) => r.path === "/api/player/preferences" && r.method === "GET"
      );
      const patchRoute = allRoutes.find(
        (r) => r.path === "/api/player/preferences" && r.method === "PATCH"
      );
      const putRoute = allRoutes.find(
        (r) => r.path === "/api/player/preferences" && r.method === "PUT"
      );

      expect(getRoute).toBeDefined();
      expect(patchRoute).toBeDefined();
      expect(putRoute).toBeDefined();
    });
  });

  describe("cache strategy types", () => {
    it("should use replace-all for list endpoints", () => {
      const librariesList = allRoutes.find(
        (r) => r.path === "/api/libraries" && r.method === "GET"
      );
      const playlistsList = allRoutes.find(
        (r) => r.path === "/api/playlists" && r.method === "GET"
      );

      expect(librariesList?.cacheConfig?.strategy).toBe("replace-all");
      expect(playlistsList?.cacheConfig?.strategy).toBe("replace-all");
    });

    it("should use upsert for single-item endpoints", () => {
      const libraryDetail = allRoutes.find(
        (r) => r.path === "/api/libraries/:id" && r.method === "GET"
      );
      const playlistDetail = allRoutes.find(
        (r) => r.path === "/api/playlists/:id" && r.method === "GET"
      );
      const songDetail = allRoutes.find(
        (r) => r.path === "/api/songs/:id" && r.method === "GET"
      );

      expect(libraryDetail?.cacheConfig?.strategy).toBe("upsert");
      expect(playlistDetail?.cacheConfig?.strategy).toBe("upsert");
      expect(songDetail?.cacheConfig?.strategy).toBe("upsert");
    });

    it("should use replace-by-key for child resource lists", () => {
      const librarySongs = allRoutes.find(
        (r) => r.path === "/api/libraries/:id/songs" && r.method === "GET"
      );
      const playlistSongs = allRoutes.find(
        (r) => r.path === "/api/playlists/:id/songs" && r.method === "GET"
      );

      expect(librarySongs?.cacheConfig?.strategy).toBe("replace-by-key");
      expect(playlistSongs?.cacheConfig?.strategy).toBe("replace-by-key");
    });
  });
});
