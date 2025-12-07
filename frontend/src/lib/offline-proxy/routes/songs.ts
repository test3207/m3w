/**
 * Song routes for offline-proxy
 * 
 * All cache operations use /api/ URLs.
 * 
 * @related When modifying routes, sync these files:
 * - shared/src/api-contracts.ts - Route definitions and offline capability
 * - backend/src/routes/songs.ts - Backend route handlers
 * - frontend/src/services/api/main/endpoints.ts - Frontend endpoint definitions
 * - frontend/src/services/api/main/resources/songs.ts - Frontend API methods
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { db, markDeleted } from "../../db/schema";
import { deleteFromCache } from "../../pwa/cache-manager";
import { isGuestUser } from "../utils";
import { logger } from "@/lib/logger-client";

const app = new Hono();

// GET /songs/:id - Get song by ID
app.get("/:id", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const song = await db.songs.get(id);

    // Treat soft-deleted as not found
    if (!song || song._isDeleted) {
      return c.json(
        {
          success: false,
          error: "Song not found",
        },
        404
      );
    }

    return c.json({
      success: true,
      data: song,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: "Failed to fetch song",
      },
      500
    );
  }
});

// DELETE /songs/:id - Delete song from library
// Query param: libraryId (required)
app.delete("/:id", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const libraryId = c.req.query("libraryId");

    if (!libraryId) {
      return c.json(
        {
          success: false,
          error: "libraryId is required",
        },
        400
      );
    }

    // Get song to check if it exists and belongs to the library
    const song = await db.songs.get(id);

    if (!song) {
      return c.json(
        {
          success: false,
          error: "Song not found",
        },
        404
      );
    }

    if (song.libraryId !== libraryId) {
      return c.json(
        {
          success: false,
          error: "Song does not belong to this library",
        },
        403
      );
    }

    // Get affected playlist IDs before deletion (for songCount update)
    const affectedPlaylistSongs = await db.playlistSongs.where("songId").equals(id).toArray();
    const affectedPlaylistIds = [...new Set(affectedPlaylistSongs.filter(ps => !ps._isDeleted).map(ps => ps.playlistId))];

    if (isGuestUser()) {
      // Guest user: hard delete immediately (no sync needed)
      await db.songs.delete(id);
      
      // Hard delete playlistSongs referencing this song
      await db.playlistSongs.where("songId").equals(id).delete();
    } else {
      // Auth user: soft delete for sync
      await db.songs.put(markDeleted(song));
      
      // Soft delete playlistSongs referencing this song
      await Promise.all(affectedPlaylistSongs.map(ps => db.playlistSongs.put(markDeleted(ps))));
    }

    // Update library songCount
    const library = await db.libraries.get(libraryId);
    if (library) {
      await db.libraries.update(libraryId, {
        songCount: Math.max(0, (library.songCount || 0) - 1),
      });
    }

    // Update affected playlists' songCount
    for (const playlistId of affectedPlaylistIds) {
      const playlist = await db.playlists.get(playlistId);
      if (playlist) {
        await db.playlists.update(playlistId, {
          songCount: Math.max(0, (playlist.songCount || 0) - 1),
        });
      }
    }

    // Delete cached audio file from Cache Storage
    try {
      await deleteFromCache(`/api/songs/${id}/stream`);
    } catch (cacheError) {
      // Log but don't fail - audio may not be cached
      logger.warn("[OfflineProxy] Failed to delete cached audio:", cacheError);
    }

    // Delete cached cover from Cache Storage if exists
    if (song.coverUrl) {
      try {
        await deleteFromCache(song.coverUrl);
      } catch {
        // Cover may not be in cache
      }
    }

    return c.json({
      success: true,
      data: null,
    });
  } catch (error) {
    logger.error("[OfflineProxy] Failed to delete song:", error);
    return c.json(
      {
        success: false,
        error: "Failed to delete song",
      },
      500
    );
  }
});

// GET /songs/:id/stream - Not needed
// Service Worker serves cached files directly from Cache Storage

export { app as songRoutes };
