/**
 * Playlist routes for offline-proxy
 * 
 * Data storage strategy:
 * - Playlist metadata (including songCount) stored in `playlists` table
 * - Song relationships stored in `playlistSongs` table (junction table)
 * 
 * @related When modifying routes, sync these files:
 * - shared/src/api-contracts.ts - Route definitions and offline capability
 * - backend/src/routes/playlists.ts - Backend route handlers
 * - frontend/src/services/api/main/endpoints.ts - Frontend endpoint definitions
 * - frontend/src/services/api/main/resources/playlists.ts - Frontend API methods
 */

import { Hono } from "hono";
import type { Context } from "hono";
// Import schemas from subpath (these require Zod, but this module is lazy-loaded anyway)
import { createPlaylistSchema, updatePlaylistSchema } from "@m3w/shared/schemas";
import { toPlaylistResponse } from "@m3w/shared/transformers";
import type { ApiResponse, PlaylistReorderResult } from "@m3w/shared";
import { getUserId } from "../utils";
import { logger } from "../../logger-client";
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

const app = new Hono();

// GET /playlists - List all playlists
app.get("/", async (c: Context) => {
  try {
    const userId = getUserId();
    const playlists = await getUserPlaylistsWithCovers(userId);
    return c.json({ success: true, data: playlists });
  } catch {
    return c.json({ success: false, error: "Failed to fetch playlists" }, 500);
  }
});

// GET /playlists/by-library/:libraryId - Get playlist linked to library
// Note: This route must be defined BEFORE /:id to avoid conflict
app.get("/by-library/:libraryId", async (c: Context) => {
  try {
    const libraryId = c.req.param("libraryId");
    const userId = getUserId();
    const playlist = await getPlaylistByLibraryId(libraryId, userId);
    return c.json({ success: true, data: playlist });
  } catch {
    return c.json({ success: false, error: "Failed to fetch library playlist" }, 500);
  }
});

// POST /playlists/for-library - Create playlist linked to library
app.post("/for-library", async (c: Context) => {
  try {
    const body = await c.req.json();
    const { name, linkedLibraryId, songIds } = body;
    const userId = getUserId();
    const playlist = await createPlaylist(userId, { name, linkedLibraryId, songIds });
    return c.json({ success: true, data: playlist }, 201);
  } catch {
    return c.json({ success: false, error: "Failed to create library playlist" }, 500);
  }
});

// GET /playlists/:id - Get playlist by ID
app.get("/:id", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const userId = getUserId();
    const playlist = await getPlaylistById(id, userId);

    if (!playlist) {
      return c.json({ success: false, error: "Playlist not found" }, 404);
    }

    return c.json({ success: true, data: playlist });
  } catch {
    return c.json({ success: false, error: "Failed to fetch playlist" }, 500);
  }
});

// POST /playlists - Create new playlist
app.post("/", async (c: Context) => {
  try {
    const body = await c.req.json();
    const data = createPlaylistSchema.parse(body);
    const userId = getUserId();
    const playlist = await createPlaylist(userId, { name: data.name, description: data.description });
    return c.json({ success: true, data: toPlaylistResponse(playlist) }, 201);
  } catch {
    return c.json({ success: false, error: "Failed to create playlist" }, 500);
  }
});

// PATCH /playlists/:id - Update playlist
app.patch("/:id", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updatePlaylistSchema.parse(body);
    const userId = getUserId();
    const playlist = await updatePlaylist(id, userId, data);

    if (!playlist) {
      return c.json({ success: false, error: "Playlist not found" }, 404);
    }

    return c.json({ success: true, data: toPlaylistResponse(playlist) });
  } catch {
    return c.json({ success: false, error: "Failed to update playlist" }, 500);
  }
});

// DELETE /playlists/:id - Delete playlist
app.delete("/:id", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const userId = getUserId();
    const deleted = await deletePlaylist(id, userId);

    if (!deleted) {
      return c.json({ success: false, error: "Playlist not found" }, 404);
    }

    return c.json({ success: true });
  } catch {
    return c.json({ success: false, error: "Failed to delete playlist" }, 500);
  }
});

// GET /playlists/:id/songs - Get songs in playlist
app.get("/:id/songs", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const userId = getUserId();
    const songs = await getPlaylistSongs(id, userId);

    if (!songs) {
      return c.json({ success: false, error: "Playlist not found" }, 404);
    }

    return c.json({ success: true, data: songs });
  } catch {
    return c.json({ success: false, error: "Failed to fetch playlist songs" }, 500);
  }
});

// POST /playlists/:id/songs - Add song to playlist
app.post("/:id/songs", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { songId } = body;
    const userId = getUserId();
    const result = await addSongToPlaylist(id, songId, userId);

    if (!result.success) {
      const status = result.error === "Playlist not found" || result.error === "Song not found" ? 404 : 400;
      return c.json({ success: false, error: result.error }, status);
    }

    return c.json({ success: true, data: result.data }, 201);
  } catch {
    return c.json({ success: false, error: "Failed to add song to playlist" }, 500);
  }
});

// PUT /playlists/:id/songs/reorder - Reorder songs in playlist
app.put("/:id/songs/reorder", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const userId = getUserId();
    const body = await c.req.json();
    const { songIds } = body as { songIds: string[] };
    const result = await reorderPlaylistSongs(id, songIds, userId);

    if (!result.success) {
      const status = result.error === "Playlist not found" ? 404 : 400;
      return c.json({ success: false, error: result.error }, status);
    }

    return c.json<ApiResponse<PlaylistReorderResult>>({ success: true, data: result.data! });
  } catch (error) {
    logger.error("Failed to reorder songs in playlist", { error });
    return c.json<ApiResponse<never>>({ success: false, error: "Failed to reorder songs in playlist" }, 500);
  }
});

// PUT /playlists/:id/songs - Update playlist songs (batch)
app.put("/:id/songs", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { songIds } = body;
    const userId = getUserId();
    const success = await replacePlaylistSongs(id, songIds, userId);

    if (!success) {
      return c.json({ success: false, error: "Playlist not found" }, 404);
    }

    return c.json({ success: true });
  } catch {
    return c.json({ success: false, error: "Failed to update playlist songs" }, 500);
  }
});

// DELETE /playlists/:id/songs/:songId - Remove song from playlist
app.delete("/:id/songs/:songId", async (c: Context) => {
  try {
    const playlistId = c.req.param("id");
    const songId = c.req.param("songId");
    const userId = getUserId();
    const result = await removeSongFromPlaylist(playlistId, songId, userId);

    if (!result.success) {
      const status = result.error === "Playlist not found" || result.error === "Song not in playlist" ? 404 : 400;
      return c.json({ success: false, error: result.error }, status);
    }

    return c.json({ success: true, data: result.data });
  } catch {
    return c.json({ success: false, error: "Failed to remove song from playlist" }, 500);
  }
});

export { app as playlistRoutes };
