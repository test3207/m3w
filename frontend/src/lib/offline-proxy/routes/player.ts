/**
 * Player routes for offline-proxy (Guest Mode - IndexedDB backed)
 * 
 * @related When modifying routes, sync these files:
 * - shared/src/api-contracts.ts - Route definitions and offline capability
 * - backend/src/routes/player.ts - Backend route handlers
 * - frontend/src/services/api/main/endpoints.ts - Frontend endpoint definitions
 * - frontend/src/services/api/main/resources/player.ts - Frontend API methods
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { db } from "../../db/schema";
import {
  RepeatMode,
  type ApiResponse,
  type ProgressSyncResult,
  type PreferencesUpdateResult,
} from "@m3w/shared";
import { getUserId } from "../utils";

const app = new Hono();

// GET /player/progress - Get playback progress
app.get("/progress", async (c: Context) => {
  try {
    const userId = getUserId();
    const progress = await db.playerProgress.get(userId);

    if (!progress) {
      return c.json({
        success: true,
        data: null,
      });
    }

    // Get song details from IndexedDB
    const song = await db.songs.get(progress.songId);
    if (!song) {
      return c.json({
        success: true,
        data: null,
      });
    }

    // Determine context (library or playlist)
    let context = null;

    // Try to find which playlist contains this song via PlaylistSong table
    const playlistSongEntry = await db.playlistSongs
      .where("songId")
      .equals(song.id)
      .first();
    
    let playlistWithSong = null;
    if (playlistSongEntry && !playlistSongEntry._isDeleted) {
      const playlist = await db.playlists.get(playlistSongEntry.playlistId);
      if (playlist && !playlist._isDeleted && playlist.userId === userId) {
        playlistWithSong = playlist;
      }
    }

    if (playlistWithSong) {
      context = {
        type: "playlist",
        id: playlistWithSong.id,
        name: playlistWithSong.name,
      };
    } else {
      // Fallback to library (Song.libraryId is direct reference)
      if (song.libraryId) {
        const library = await db.libraries.get(song.libraryId);
        if (library) {
          context = {
            type: "library",
            id: library.id,
            name: library.name,
          };
        }
      }
    }

    // Return in backend API format
    return c.json({
      success: true,
      data: {
        track: {
          id: song.id,
          title: song.title,
          artist: song.artist,
          album: song.album,
          coverUrl: song.coverUrl,
          duration: progress.duration,
          mimeType: song.mimeType ?? "audio/mpeg",
        },
        position: progress.position,
        context,
        updatedAt: progress.updatedAt.toISOString(),
      },
    });
  } catch {
    return c.json({
      success: true,
      data: null,
    });
  }
});

// PUT /player/progress - Sync playback progress
app.put("/progress", async (c: Context) => {
  try {
    const userId = getUserId();
    const body = await c.req.json();

    // Extract fields from request body
    const { songId, position, contextType, contextId, contextName } = body;

    // Get current song to determine duration
    const song = await db.songs.get(songId);
    const duration = song?.duration ?? 0;

    await db.playerProgress.put({
      userId,
      songId,
      position,
      duration,
      contextType,
      contextId,
      contextName,
      updatedAt: new Date(),
    });

    return c.json<ApiResponse<ProgressSyncResult>>({
      success: true,
      data: { synced: true },
    });
  } catch {
    return c.json<ApiResponse<never>>(
      {
        success: false,
        error: "Failed to save progress",
      },
      500
    );
  }
});

// GET /player/seed - Get default playback seed
app.get("/seed", async (c: Context) => {
  try {
    const userId = getUserId();

    // Try to find first playlist with songs
    const playlists = await db.playlists
      .where("userId")
      .equals(userId)
      .sortBy("createdAt");

    for (const playlist of playlists) {
      // Get first song from PlaylistSong table
      const playlistSongs = await db.playlistSongs
        .where("playlistId")
        .equals(playlist.id)
        .toArray();
      const activeSongs = playlistSongs
        .filter(ps => !ps._isDeleted)
        .sort((a, b) => a.order - b.order);
      
      if (activeSongs.length > 0) {
        const firstSongId = activeSongs[0].songId;
        const song = await db.songs.get(firstSongId);

        if (song) {
          return c.json({
            success: true,
            data: {
              track: {
                id: song.id,
                title: song.title,
                artist: song.artist,
                album: song.album,
                coverUrl: song.coverUrl,
                mimeType: song.mimeType ?? "audio/mpeg",
                duration: song.duration ?? null,
              },
              context: {
                type: "playlist",
                id: playlist.id,
                name: playlist.name,
              },
            },
          });
        }
      }
    }

    // Fallback to first library with songs
    const libraries = await db.libraries
      .where("userId")
      .equals(userId)
      .sortBy("createdAt");

    for (const library of libraries) {
      const songs = await db.songs
        .where("libraryId")
        .equals(library.id)
        .limit(1)
        .toArray();

      const song = songs[0];
      if (song) {
        return c.json({
          success: true,
          data: {
            track: {
              id: song.id,
              title: song.title,
              artist: song.artist,
              album: song.album,
              coverUrl: song.coverUrl,
              mimeType: song.mimeType ?? "audio/mpeg",
              duration: song.duration ?? null,
            },
            context: {
              type: "library",
              id: library.id,
              name: library.name,
            },
          },
        });
      }
    }

    // No seed available
    return c.json({
      success: true,
      data: null,
    });
  } catch {
    return c.json({
      success: true,
      data: null,
    });
  }
});

// GET /player/preferences - Get user preferences
app.get("/preferences", async (c: Context) => {
  try {
    const userId = getUserId();
    const preferences = await db.playerPreferences.get(userId);

    return c.json({
      success: true,
      data: preferences || {
        volume: 1,
        muted: false,
        repeatMode: RepeatMode.Off,
        shuffleEnabled: false,
      },
    });
  } catch {
    return c.json({
      success: true,
      data: {
        volume: 1,
        muted: false,
        repeatMode: RepeatMode.Off,
        shuffleEnabled: false,
      },
    });
  }
});

// PATCH /player/preferences - Update user preferences
app.patch("/preferences", async (c: Context) => {
  try {
    const userId = getUserId();
    const body = await c.req.json();
    const current = await db.playerPreferences.get(userId);

    const updated = {
      userId,
      volume: body.volume ?? current?.volume ?? 1,
      muted: body.muted ?? current?.muted ?? false,
      repeatMode: body.repeatMode ?? current?.repeatMode ?? "off",
      shuffleEnabled: body.shuffleEnabled ?? current?.shuffleEnabled ?? false,
      updatedAt: new Date(),
    };

    await db.playerPreferences.put(updated);

    return c.json<ApiResponse<PreferencesUpdateResult>>({
      success: true,
      data: { updated: true },
    });
  } catch {
    return c.json<ApiResponse<never>>(
      {
        success: false,
        error: "Failed to update preferences",
      },
      500
    );
  }
});

// PUT /player/preferences - Update user preferences (alias for PATCH)
app.put("/preferences", async (c: Context) => {
  try {
    const userId = getUserId();
    const body = await c.req.json();
    const current = await db.playerPreferences.get(userId);

    const updated = {
      userId,
      volume: body.volume ?? current?.volume ?? 1,
      muted: body.muted ?? current?.muted ?? false,
      repeatMode: body.repeatMode ?? current?.repeatMode ?? "off",
      shuffleEnabled: body.shuffleEnabled ?? current?.shuffleEnabled ?? false,
      updatedAt: new Date(),
    };

    await db.playerPreferences.put(updated);

    return c.json<ApiResponse<PreferencesUpdateResult>>({
      success: true,
      data: { updated: true },
    });
  } catch {
    return c.json<ApiResponse<never>>(
      {
        success: false,
        error: "Failed to update preferences",
      },
      500
    );
  }
});

export { app as playerRoutes };
