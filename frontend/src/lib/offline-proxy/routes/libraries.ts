/**
 * Library routes for offline-proxy
 * 
 * @related When modifying routes, sync these files:
 * - shared/src/api-contracts.ts - Route definitions and offline capability
 * - backend/src/routes/libraries.ts - Backend route handlers
 * - frontend/src/services/api/main/endpoints.ts - Frontend endpoint definitions
 * - frontend/src/services/api/main/resources/libraries.ts - Frontend API methods
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { db } from "../../db/schema";
import type { OfflineLibrary, OfflineSong } from "../../db/schema";
import { createLibrarySchema, updateLibrarySchema, toLibraryResponse } from "@m3w/shared";
import { getUserId, isGuestUser, sortSongsOffline } from "../utils";
import { parseBlob } from "music-metadata";
import { calculateFileHash } from "../../utils/hash";
import { generateUUID } from "../../utils/uuid";
import { cacheAudioForOffline, cacheCoverForOffline } from "../../pwa/cache-manager";
import { logger } from "@/lib/logger-client";

const app = new Hono();

// GET /libraries - List all libraries
app.get("/", async (c: Context) => {
  try {
    const userId = getUserId();
    const libraries = await db.libraries
      .where("userId")
      .equals(userId)
      .reverse()
      .sortBy("createdAt");

    // Add song counts and coverSongId
    // Libraries use LAST added song for cover (vs Playlists which use FIRST song)
    const librariesWithCounts = await Promise.all(
      libraries.map(async (library) => {
        const songs = await db.songs.where("libraryId").equals(library.id).toArray();
        const songCount = songs.length;

        // Get last added song for cover (orderBy createdAt desc, matches backend)
        const sortedSongs = songs.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const lastSong = sortedSongs[0];

        return {
          ...library,
          songCount,
          coverSongId: lastSong?.id || null,
        };
      })
    );

    return c.json({
      success: true,
      data: librariesWithCounts,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: "Failed to fetch libraries",
      },
      500
    );
  }
});

// GET /libraries/:id - Get library by ID
app.get("/:id", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const userId = getUserId();

    const library = await db.libraries.get(id);

    if (!library) {
      return c.json(
        {
          success: false,
          error: "Library not found",
        },
        404
      );
    }

    // Check ownership (skip for guest to allow access to guest's own libraries)
    if (library.userId !== userId && !isGuestUser()) {
      return c.json(
        {
          success: false,
          error: "Library not found",
        },
        404
      );
    }

    // Add song count and coverSongId from last added song
    const songCount = await db.songs.where("libraryId").equals(id).count();

    // Get last added song for cover (matches backend)
    const lastSong = await db.songs
      .where("libraryId")
      .equals(id)
      .reverse()
      .sortBy("createdAt")
      .then((songs) => songs[0]);

    const libraryWithCount = {
      ...library,
      songCount,
      coverSongId: lastSong?.id || null,
    };

    return c.json({
      success: true,
      data: libraryWithCount,
    });
  } catch (error) {
    logger.error("[OfflineProxy] GET /libraries/:id error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch library",
      },
      500
    );
  }
});

// POST /libraries - Create new library
app.post("/", async (c: Context) => {
  try {
    const body = await c.req.json();
    const data = createLibrarySchema.parse(body);
    const userId = getUserId();

    const library: OfflineLibrary = {
      id: generateUUID(),
      ...data,
      description: data.description ?? null,
      userId,
      songCount: 0,
      isDefault: false,
      canDelete: true,
      cacheOverride: "inherit",  // Default: follow global setting
      coverSongId: null, // New library has no songs yet
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.libraries.add(library);

    // Transform to API response format
    return c.json(
      {
        success: true,
        data: toLibraryResponse(library),
      },
      201
    );
  } catch {
    return c.json(
      {
        success: false,
        error: "Failed to create library",
      },
      500
    );
  }
});

// PATCH /libraries/:id - Update library
app.patch("/:id", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updateLibrarySchema.parse(body);
    const userId = getUserId();

    const library = await db.libraries.get(id);

    if (!library || library.userId !== userId) {
      return c.json(
        {
          success: false,
          error: "Library not found",
        },
        404
      );
    }

    const updated: OfflineLibrary = {
      ...library,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    await db.libraries.put(updated);

    return c.json({
      success: true,
      data: toLibraryResponse(updated),
    });
  } catch {
    return c.json(
      {
        success: false,
        error: "Failed to update library",
      },
      500
    );
  }
});

// DELETE /libraries/:id - Delete library
app.delete("/:id", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const userId = getUserId();

    const library = await db.libraries.get(id);

    if (!library || library.userId !== userId) {
      return c.json(
        {
          success: false,
          error: "Library not found",
        },
        404
      );
    }

    // Hard delete with cascade
    // Delete all songs in this library
    await db.songs.where("libraryId").equals(id).delete();
    // Clear linkedLibraryId from playlists (don't delete playlists, just unlink)
    await db.playlists.where("linkedLibraryId").equals(id).modify({ linkedLibraryId: undefined });
    // Delete the library itself
    await db.libraries.delete(id);

    return c.json({
      success: true,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: "Failed to delete library",
      },
      500
    );
  }
});

// POST /libraries/:id/songs - Upload audio file to library (Offline)
// RESTful endpoint: libraryId from URL path enables validation BEFORE processing
app.post("/:id/songs", async (c: Context) => {
  try {
    const libraryId = c.req.param("id");
    const userId = getUserId();

    // Validate library ownership BEFORE processing file
    const library = await db.libraries.get(libraryId);

    if (!library) {
      return c.json(
        {
          success: false,
          error: "Library not found",
        },
        404
      );
    }

    if (library.userId !== userId && !isGuestUser()) {
      return c.json(
        {
          success: false,
          error: "Library not found",
        },
        404
      );
    }

    const formData = await c.req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return c.json({ success: false, error: "Missing file" }, 400);
    }

    // 1. Calculate hash
    const hash = await calculateFileHash(file);

    // 2. Extract metadata
    const metadata = await parseBlob(file);
    const { common, format } = metadata;

    // 3. Check if File entity exists or create new one
    let fileEntity = await db.files.where("hash").equals(hash).first();

    if (!fileEntity) {
      // Create new File entity
      fileEntity = {
        id: `file-${hash}`,
        hash,
        size: file.size,
        mimeType: file.type || "audio/mpeg",
        duration: format.duration || undefined,
        refCount: 0, // Will be incremented below
        createdAt: new Date(),
      };
      await db.files.add(fileEntity);
    }

    // 4. Check if song already exists in this library (same fileId)
    const existingSong = await db.songs
      .where("libraryId")
      .equals(libraryId)
      .filter((s) => s.fileId === fileEntity!.id)
      .first();

    if (existingSong) {
      return c.json(
        {
          success: false,
          error: "This song already exists in the selected library",
          details: `"${existingSong.title}" is already in this library`,
        },
        409
      );
    }

    // 5. Generate song ID (needed for cache URLs)
    const songId = generateUUID();

    // 6. Extract cover art if available and cache it
    if (common.picture && common.picture.length > 0) {
      const picture = common.picture[0];
      // Convert Uint8Array to Blob
      const coverBlob = new Blob([new Uint8Array(picture.data)], {
        type: picture.format,
      });

      // Cache cover in Cache Storage using unified /api/ URL
      await cacheCoverForOffline(songId, coverBlob);
    }

    // 7. Cache audio file in Cache Storage using unified /api/ URL
    const streamUrl = await cacheAudioForOffline(songId, file);

    // 8. Create Song object
    const now = new Date().toISOString();

    const song: OfflineSong = {
      id: songId,
      libraryId, // ✅ Required field (one-to-many relationship)
      title: common.title || file.name.replace(/\.[^/.]+$/, ""),
      artist: common.artist || "Unknown Artist",
      album: common.album || "Unknown Album",
      albumArtist: common.albumartist || null,
      year: common.year || null,
      genre: common.genre && common.genre.length > 0 ? common.genre[0] : null,
      trackNumber: common.track.no || null,
      discNumber: common.disk.no || null,
      composer:
        common.composer && common.composer.length > 0 ? common.composer[0] : null,
      streamUrl, // Unified URL: /api/songs/{id}/stream (works for both Guest and Auth)
      fileId: fileEntity.id, // Reference to File entity
      duration: format.duration || null,
      mimeType: fileEntity.mimeType, // Audio format (audio/mpeg, audio/flac, etc.)
      createdAt: now,
      updatedAt: now,
      // Cache status fields
      isCached: true,
      cacheSize: file.size, // Set cache size to file size
      lastCacheCheck: Date.now(),
      fileHash: hash, // Keep for quick lookup
    };

    // 9. Save song to IndexedDB, increment File refCount, and update library songCount
    await db.transaction("rw", [db.songs, db.files, db.libraries], async () => {
      await db.songs.add(song);

      // Increment refCount
      await db.files.update(fileEntity!.id, {
        refCount: fileEntity!.refCount + 1,
      });

      // Increment library songCount (matches backend logic)
      if (library) {
        await db.libraries.update(library.id, {
          songCount: (library.songCount ?? 0) + 1,
        });
      }
    });

    // Response structure matches backend: { song }
    return c.json({
      success: true,
      data: {
        song: {
          ...song,
          // coverUrl already set in songData
        },
      },
    });
  } catch (error) {
    logger.error("[OfflineProxy] Offline upload failed", error);
    return c.json({ success: false, error: "Upload failed" }, 500);
  }
});

// GET /libraries/:id/songs - Get songs in library
app.get("/:id/songs", async (c: Context) => {
  try {
    const id = c.req.param("id");
    const userId = getUserId();
    const sortParam = (c.req.query("sort") || "date-desc") as string;

    const library = await db.libraries.get(id);

    if (!library || library.userId !== userId) {
      return c.json(
        {
          success: false,
          error: "Library not found",
        },
        404
      );
    }

    // Query songs by libraryId (one-to-many relationship)
    const songs = await db.songs.where("libraryId").equals(id).toArray();

    // Apply sorting (matches backend logic)
    const sortedSongs = sortSongsOffline(songs, sortParam);

    return c.json({
      success: true,
      data: sortedSongs,
    });
  } catch {
    return c.json(
      {
        success: false,
        error: "Failed to fetch songs",
      },
      500
    );
  }
});

export { app as libraryRoutes };
