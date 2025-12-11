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
import { db } from "../../db/schema";
import type { OfflinePlaylist, OfflinePlaylistSong } from "../../db/schema";
import {
  createPlaylistSchema,
  updatePlaylistSchema,
  toPlaylistResponse,
} from "@m3w/shared";
import type { ApiResponse, PlaylistReorderResult } from "@m3w/shared";
import { getUserId } from "../utils";
import { generateUUID } from "../../utils/uuid";
import { logger } from "../../logger-client";

const app = new Hono();

/**
 * Helper: Get first song's cover URL for a playlist
 */
async function getPlaylistCoverUrl(playlistId: string): Promise<string | null> {
  const playlistSongs = await db.playlistSongs
    .where("playlistId")
    .equals(playlistId)
    .toArray();
  const sortedSongs = playlistSongs.sort((a, b) => a.order - b.order);
  
  const firstPlaylistSong = sortedSongs[0];
  if (!firstPlaylistSong) return null;
  
  const song = await db.songs.get(firstPlaylistSong.songId);
  return song?.coverUrl || null;
}

// GET /playlists - List all playlists
app.get("/", async (c: Context) => {
  try {
    const userId = getUserId();
    const playlists = await db.playlists
      .where("userId")
      .equals(userId)
      .reverse()
      .sortBy("createdAt");

    // Add coverUrl (songCount already stored in playlist)
    const playlistsWithData = await Promise.all(
      playlists.map(async (playlist) => {
        const coverUrl = await getPlaylistCoverUrl(playlist.id);
        return {
          ...playlist,
          coverUrl,
        };
      })
    );

    return c.json({
      success: true,
      data: playlistsWithData,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: "Failed to fetch playlists",
      },
      500
    );
  }
});

// GET /playlists/by-library/:libraryId - Get playlist linked to library
// Note: This route must be defined BEFORE /:id to avoid conflict
app.get("/by-library/:libraryId", async (c: Context) => {
  try {
    const libraryId = c.req.param("libraryId");
    const userId = getUserId();

    // Find playlist with linkedLibraryId
    const playlist = await db.playlists
      .where("linkedLibraryId")
      .equals(libraryId)
      .first();

    if (!playlist) {
      return c.json({
        success: true,
        data: null,
      });
    }

    if (playlist.userId !== userId) {
      return c.json({
        success: true,
        data: null,
      });
    }

    return c.json({
      success: true,
      data: playlist,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: "Failed to fetch library playlist",
      },
      500
    );
  }
});

// POST /playlists/for-library - Create playlist linked to library
app.post("/for-library", async (c: Context) => {
  try {
    const body = await c.req.json();
    const { name, linkedLibraryId, songIds } = body;
    const userId = getUserId();

    const songCount = songIds?.length || 0;
    const playlist: OfflinePlaylist = {
      id: generateUUID(),
      name,
      description: null,
      userId,
      songCount,
      linkedLibraryId,
      isDefault: false,
      canDelete: true,
      coverUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.playlists.add(playlist);

    // Add playlist songs
    if (songIds && songIds.length > 0) {
      const playlistSongsData: OfflinePlaylistSong[] = songIds.map((songId: string, index: number) => ({
        playlistId: playlist.id,
        songId,
        order: index,
        addedAt: new Date().toISOString(),
      }));
      await db.playlistSongs.bulkAdd(playlistSongsData);
    }

    return c.json(
      {
        success: true,
        data: playlist,
      },
      201
    );
  } catch {
    return c.json(
      {
        success: false,
        error: "Failed to create library playlist",
      },
      500
    );
  }
});

// GET /playlists/:id - Get playlist by ID
app.get("/:id", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const userId = getUserId();

    const playlist = await db.playlists.get(id);

    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: "Playlist not found",
        },
        404
      );
    }

    // Add coverUrl (songCount already stored in playlist)
    const coverUrl = await getPlaylistCoverUrl(id);

    return c.json({
      success: true,
      data: {
        ...playlist,
        coverUrl,
      },
    });
  } catch {
    return c.json(
      {
        success: false,
        error: "Failed to fetch playlist",
      },
      500
    );
  }
});

// POST /playlists - Create new playlist
app.post("/", async (c: Context) => {
  try {
    const body = await c.req.json();
    const data = createPlaylistSchema.parse(body);
    const userId = getUserId();

    const playlist: OfflinePlaylist = {
      id: generateUUID(),
      ...data,
      description: data.description ?? null,
      userId,
      songCount: 0,
      linkedLibraryId: null,
      isDefault: false,
      canDelete: true,
      coverUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.playlists.add(playlist);

    // Transform to API response format
    return c.json(
      {
        success: true,
        data: toPlaylistResponse(playlist),
      },
      201
    );
  } catch {
    return c.json(
      {
        success: false,
        error: "Failed to create playlist",
      },
      500
    );
  }
});

// PATCH /playlists/:id - Update playlist
app.patch("/:id", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updatePlaylistSchema.parse(body);
    const userId = getUserId();

    const playlist = await db.playlists.get(id);

    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: "Playlist not found",
        },
        404
      );
    }

    const updated: OfflinePlaylist = {
      ...playlist,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    await db.playlists.put(updated);

    return c.json({
      success: true,
      data: toPlaylistResponse(updated),
    });
  } catch {
    return c.json(
      {
        success: false,
        error: "Failed to update playlist",
      },
      500
    );
  }
});

// DELETE /playlists/:id - Delete playlist
app.delete("/:id", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const userId = getUserId();

    const playlist = await db.playlists.get(id);

    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: "Playlist not found",
        },
        404
      );
    }

    // Hard delete playlist and its song relationships
    await db.playlists.delete(id);
    await db.playlistSongs.where("playlistId").equals(id).delete();

    return c.json({
      success: true,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: "Failed to delete playlist",
      },
      500
    );
  }
});

// GET /playlists/:id/songs - Get songs in playlist
app.get("/:id/songs", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const userId = getUserId();

    const playlist = await db.playlists.get(id);

    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: "Playlist not found",
        },
        404
      );
    }

    // Get playlist songs from IndexedDB (sort by order)
    const playlistSongs = await db.playlistSongs
      .where("playlistId")
      .equals(id)
      .toArray();
    const sortedPlaylistSongs = playlistSongs.sort((a, b) => a.order - b.order);

    // Get full song details with library name
    const songs = await Promise.all(
      sortedPlaylistSongs.map(async (ps) => {
        const song = await db.songs.get(ps.songId);
        // Skip if song not found
        if (!song) return undefined;

        // Get library name if not already present on song
        let libraryName = song.libraryName;
        if (!libraryName && song.libraryId) {
          const library = await db.libraries.get(song.libraryId);
          libraryName = library?.name ?? null;
        }

        return {
          ...song,
          libraryName,
        };
      })
    );

    // Filter out any songs that weren't found
    const validSongs = songs.filter((song) => song !== undefined);

    return c.json({
      success: true,
      data: validSongs,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: "Failed to fetch playlist songs",
      },
      500
    );
  }
});

// POST /playlists/:id/songs - Add song to playlist
app.post("/:id/songs", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { songId } = body;
    const userId = getUserId();

    const playlist = await db.playlists.get(id);

    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: "Playlist not found",
        },
        404
      );
    }

    const song = await db.songs.get(songId);

    if (!song) {
      return c.json(
        {
          success: false,
          error: "Song not found",
        },
        404
      );
    }

    // Check if song already in playlist
    const existingEntry = await db.playlistSongs
      .where("[playlistId+songId]")
      .equals([id, songId])
      .first();

    if (existingEntry) {
      return c.json(
        {
          success: false,
          error: "Song is already in playlist",
        },
        400
      );
    }

    // Get current max order
    const existingSongs = await db.playlistSongs
      .where("playlistId")
      .equals(id)
      .toArray();
    const maxOrder = existingSongs.length > 0
      ? Math.max(...existingSongs.map((ps) => ps.order))
      : -1;

    // Add to playlist
    const playlistSong: OfflinePlaylistSong = {
      playlistId: id,
      songId,
      order: maxOrder + 1,
      addedAt: new Date().toISOString(),
    };

    await db.playlistSongs.add(playlistSong);

    // Get new song count
    const newSongCount = existingSongs.length + 1;

    // Update playlist timestamp and songCount
    await db.playlists.update(id, {
      songCount: newSongCount,
      updatedAt: new Date().toISOString(),
    });

    // Return response matching backend format
    return c.json(
      {
        success: true,
        data: {
          playlistId: id,
          songId,
          newSongCount,
        },
      },
      201
    );
  } catch {
    return c.json(
      {
        success: false,
        error: "Failed to add song to playlist",
      },
      500
    );
  }
});

// PUT /playlists/:id/songs/reorder - Reorder songs in playlist
app.put("/:id/songs/reorder", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const userId = getUserId();
    const body = await c.req.json();
    const { songIds } = body as { songIds: string[] };

    // Check if playlist exists and belongs to user
    const playlist = await db.playlists.get(id);
    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: "Playlist not found",
        },
        404
      );
    }

    // Validate that all songIds exist
    const songs = await db.songs.bulkGet(songIds);
    const validSongIds = songs.filter((s) => s !== undefined).map((s) => s!.id);

    if (validSongIds.length !== songIds.length) {
      return c.json(
        {
          success: false,
          error: "Invalid song order",
        },
        400
      );
    }

    // Update playlistSongs order field using bulkPut for efficiency
    const allPlaylistSongs = await db.playlistSongs
      .where("playlistId")
      .equals(id)
      .toArray();

    // Create updated entries with new order
    const orderMap = new Map(songIds.map((songId, index) => [songId, index]));
    const updatedEntries = allPlaylistSongs.map(ps => {
      const newOrder = orderMap.get(ps.songId);
      if (newOrder !== undefined) {
        return { ...ps, order: newOrder };
      }
      return ps;
    });

    // Bulk update
    await db.playlistSongs.bulkPut(updatedEntries);

    // Update playlist timestamp
    await db.playlists.update(id, {
      updatedAt: new Date().toISOString(),
    });

    return c.json<ApiResponse<PlaylistReorderResult>>({
      success: true,
      data: {
        playlistId: id,
        songCount: songIds.length,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Failed to reorder songs in playlist", { error });
    return c.json<ApiResponse<never>>(
      {
        success: false,
        error: "Failed to reorder songs in playlist",
      },
      500
    );
  }
});

// PUT /playlists/:id/songs - Update playlist songs (batch)
app.put("/:id/songs", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { songIds } = body;
    const userId = getUserId();

    const playlist = await db.playlists.get(id);

    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: "Playlist not found",
        },
        404
      );
    }

    // Use transaction for atomicity
    await db.transaction("rw", db.playlistSongs, db.playlists, async () => {
      // Hard delete existing playlist songs
      await db.playlistSongs.where("playlistId").equals(id).delete();

      // Add new songs
      if (songIds && songIds.length > 0) {
        const playlistSongsData: OfflinePlaylistSong[] = songIds.map((songId: string, index: number) => ({
          playlistId: id,
          songId,
          order: index,
          addedAt: new Date().toISOString(),
        }));
        await db.playlistSongs.bulkPut(playlistSongsData);
      }

      // Update playlist timestamp and songCount
      await db.playlists.update(id, {
        songCount: songIds?.length || 0,
        updatedAt: new Date().toISOString(),
      });
    });

    return c.json({
      success: true,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: "Failed to update playlist songs",
      },
      500
    );
  }
});

// DELETE /playlists/:id/songs/:songId - Remove song from playlist
app.delete("/:id/songs/:songId", async (c: Context) => {
  try {
    const playlistId = c.req.param("id");
    const songId = c.req.param("songId");
    const userId = getUserId();

    const playlist = await db.playlists.get(playlistId);

    if (!playlist || playlist.userId !== userId) {
      return c.json(
        {
          success: false,
          error: "Playlist not found",
        },
        404
      );
    }

    // Find the playlist song entry
    const playlistSong = await db.playlistSongs
      .where("[playlistId+songId]")
      .equals([playlistId, songId])
      .first();

    if (!playlistSong) {
      return c.json(
        {
          success: false,
          error: "Song not in playlist",
        },
        404
      );
    }

    // Get current song count before deletion
    const currentCount = await db.playlistSongs
      .where("playlistId")
      .equals(playlistId)
      .count();

    // Hard delete the playlist song entry
    await db.playlistSongs.delete([playlistSong.playlistId, playlistSong.songId]);

    const newSongCount = currentCount - 1;

    // Update playlist timestamp and songCount
    await db.playlists.update(playlistId, {
      songCount: Math.max(0, newSongCount),
      updatedAt: new Date().toISOString(),
    });

    // Return response matching backend format
    return c.json({
      success: true,
      data: {
        playlistId,
        songId,
        newSongCount,
      },
    });
  } catch {
    return c.json(
      {
        success: false,
        error: "Failed to remove song from playlist",
      },
      500
    );
  }
});

export { app as playlistRoutes };
