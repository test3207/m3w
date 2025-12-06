/**
 * Schema Helper Functions Tests
 * Tests for dirty tracking, sync helpers, and Dexie composite primary keys
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { 
  db, 
  clearAllData, 
  markDirty, 
  markDeleted, 
  markSynced, 
  type SyncTrackingFields,
  type OfflinePlaylistSong 
} from "../schema";

// Mock the isGuestUser function
vi.mock("../../offline-proxy/utils", () => ({
  isGuestUser: vi.fn(() => false),
}));

import { isGuestUser } from "../../offline-proxy/utils";

// Test entity type that extends SyncTrackingFields with additional properties
type TestEntity = SyncTrackingFields & {
  id: string;
  name?: string;
  description?: string;
};

describe("markDirty", () => {
  beforeEach(() => {
    vi.mocked(isGuestUser).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should mark entity as dirty for authenticated user", () => {
    const entity: TestEntity = { id: "1", name: "Test" };
    const result = markDirty(entity);
    
    expect(result._isDirty).toBe(true);
    expect(result._lastModifiedAt).toBeDefined();
    expect(typeof result._lastModifiedAt).toBe("number");
  });

  it("should NOT mark entity as dirty for guest user", () => {
    vi.mocked(isGuestUser).mockReturnValue(true);
    
    const entity: TestEntity = { id: "1", name: "Test" };
    const result = markDirty(entity);
    
    expect(result._isDirty).toBe(false);
  });

  it("should set _isLocalOnly=true when isNew=true for auth user", () => {
    const entity: TestEntity = { id: "1", name: "Test" };
    const result = markDirty(entity, true);
    
    expect(result._isLocalOnly).toBe(true);
    expect(result._isDirty).toBe(true);
  });

  it("should NOT set _isLocalOnly for guest user even when isNew=true", () => {
    vi.mocked(isGuestUser).mockReturnValue(true);
    
    const entity: TestEntity = { id: "1", name: "Test" };
    const result = markDirty(entity, true);
    
    expect(result._isLocalOnly).toBe(false);
    expect(result._isDirty).toBe(false);
  });

  it("should preserve existing _isLocalOnly when isNew=false", () => {
    const entity: TestEntity = { id: "1", _isLocalOnly: true };
    const result = markDirty(entity, false);
    
    expect(result._isLocalOnly).toBe(true);
  });

  it("should preserve other entity properties", () => {
    const entity: TestEntity = { id: "1", name: "Test", description: "Desc" };
    const result = markDirty(entity);
    
    expect(result.id).toBe("1");
    expect(result.name).toBe("Test");
    expect(result.description).toBe("Desc");
  });
});

describe("markDeleted", () => {
  beforeEach(() => {
    vi.mocked(isGuestUser).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should mark entity as deleted and dirty for auth user", () => {
    const entity: TestEntity = { id: "1", name: "Test" };
    const result = markDeleted(entity);
    
    expect(result._isDeleted).toBe(true);
    expect(result._isDirty).toBe(true);
    expect(result._lastModifiedAt).toBeDefined();
  });

  it("should mark _isDeleted but NOT _isDirty for guest user", () => {
    vi.mocked(isGuestUser).mockReturnValue(true);
    
    const entity: TestEntity = { id: "1", name: "Test" };
    const result = markDeleted(entity);
    
    expect(result._isDeleted).toBe(true);
    expect(result._isDirty).toBe(false);
  });

  it("should preserve other entity properties", () => {
    const entity: TestEntity = { id: "1", name: "Test" };
    const result = markDeleted(entity);
    
    expect(result.id).toBe("1");
    expect(result.name).toBe("Test");
  });
});

describe("markSynced", () => {
  it("should clear all sync flags", () => {
    const entity: TestEntity = {
      id: "1",
      _isDirty: true,
      _isDeleted: true,
      _isLocalOnly: true,
      _lastModifiedAt: 1000,
    };
    
    const result = markSynced(entity);
    
    expect(result._isDirty).toBe(false);
    expect(result._isDeleted).toBe(false);
    expect(result._isLocalOnly).toBe(false);
    expect(result._lastModifiedAt).toBeGreaterThan(1000);
  });

  it("should work on entity with no sync flags", () => {
    const entity: TestEntity = { id: "1", name: "Test" };
    const result = markSynced(entity);
    
    expect(result._isDirty).toBe(false);
    expect(result._isDeleted).toBe(false);
    expect(result._isLocalOnly).toBe(false);
  });

  it("should preserve other entity properties", () => {
    const entity: TestEntity = { id: "1", name: "Test", _isDirty: true };
    const result = markSynced(entity);
    
    expect(result.id).toBe("1");
    expect(result.name).toBe("Test");
  });
});

/**
 * Dexie Composite Primary Key Tests
 * Verifies that [playlistId+songId] composite key works correctly
 */
describe("PlaylistSongs Composite Primary Key", () => {
  beforeEach(async () => {
    vi.mocked(isGuestUser).mockReturnValue(false);
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  const createPlaylistSong = (playlistId: string, songId: string, order: number): OfflinePlaylistSong => ({
    playlistId,
    songId,
    order,
    addedAt: new Date().toISOString(),
    _isDirty: false,
  });

  it("should add and retrieve by composite key", async () => {
    const ps = createPlaylistSong("playlist-1", "song-1", 0);
    
    await db.playlistSongs.add(ps);
    
    // Retrieve by composite key
    const retrieved = await db.playlistSongs.get(["playlist-1", "song-1"]);
    
    expect(retrieved).toBeDefined();
    expect(retrieved?.playlistId).toBe("playlist-1");
    expect(retrieved?.songId).toBe("song-1");
    expect(retrieved?.order).toBe(0);
  });

  it("should update by composite key", async () => {
    const ps = createPlaylistSong("playlist-1", "song-1", 0);
    await db.playlistSongs.add(ps);
    
    // Update using composite key
    await db.playlistSongs.update(["playlist-1", "song-1"], { order: 5 });
    
    const updated = await db.playlistSongs.get(["playlist-1", "song-1"]);
    expect(updated?.order).toBe(5);
  });

  it("should delete by composite key", async () => {
    const ps = createPlaylistSong("playlist-1", "song-1", 0);
    await db.playlistSongs.add(ps);
    
    // Verify it exists
    expect(await db.playlistSongs.get(["playlist-1", "song-1"])).toBeDefined();
    
    // Delete by composite key
    await db.playlistSongs.delete(["playlist-1", "song-1"]);
    
    // Verify it's gone
    expect(await db.playlistSongs.get(["playlist-1", "song-1"])).toBeUndefined();
  });

  it("should enforce uniqueness on composite key", async () => {
    const ps1 = createPlaylistSong("playlist-1", "song-1", 0);
    const ps2 = createPlaylistSong("playlist-1", "song-1", 1); // Same key, different order
    
    await db.playlistSongs.add(ps1);
    
    // Adding same composite key should fail
    await expect(db.playlistSongs.add(ps2)).rejects.toThrow();
  });

  it("should allow same song in different playlists", async () => {
    const ps1 = createPlaylistSong("playlist-1", "song-1", 0);
    const ps2 = createPlaylistSong("playlist-2", "song-1", 0); // Same song, different playlist
    
    await db.playlistSongs.add(ps1);
    await db.playlistSongs.add(ps2);
    
    // Both should exist
    expect(await db.playlistSongs.get(["playlist-1", "song-1"])).toBeDefined();
    expect(await db.playlistSongs.get(["playlist-2", "song-1"])).toBeDefined();
    
    const count = await db.playlistSongs.count();
    expect(count).toBe(2);
  });

  it("should allow different songs in same playlist", async () => {
    const ps1 = createPlaylistSong("playlist-1", "song-1", 0);
    const ps2 = createPlaylistSong("playlist-1", "song-2", 1);
    const ps3 = createPlaylistSong("playlist-1", "song-3", 2);
    
    await db.playlistSongs.bulkAdd([ps1, ps2, ps3]);
    
    // Query all songs in playlist-1
    const songs = await db.playlistSongs
      .where("playlistId")
      .equals("playlist-1")
      .toArray();
    
    expect(songs.length).toBe(3);
  });

  it("should use put for upsert (insert or update)", async () => {
    const ps = createPlaylistSong("playlist-1", "song-1", 0);
    
    // First put - insert
    await db.playlistSongs.put(ps);
    expect((await db.playlistSongs.get(["playlist-1", "song-1"]))?.order).toBe(0);
    
    // Second put - update (same composite key)
    await db.playlistSongs.put({ ...ps, order: 10 });
    expect((await db.playlistSongs.get(["playlist-1", "song-1"]))?.order).toBe(10);
    
    // Should still be only 1 record
    expect(await db.playlistSongs.count()).toBe(1);
  });

  it("should support bulkPut for batch upsert", async () => {
    const songs = [
      createPlaylistSong("playlist-1", "song-1", 0),
      createPlaylistSong("playlist-1", "song-2", 1),
      createPlaylistSong("playlist-1", "song-3", 2),
    ];
    
    await db.playlistSongs.bulkPut(songs);
    expect(await db.playlistSongs.count()).toBe(3);
    
    // Update with new order
    const updatedSongs = songs.map((s, i) => ({ ...s, order: i * 10 }));
    await db.playlistSongs.bulkPut(updatedSongs);
    
    // Should still be 3 records with updated order
    expect(await db.playlistSongs.count()).toBe(3);
    expect((await db.playlistSongs.get(["playlist-1", "song-2"]))?.order).toBe(10);
  });

  it("should support querying by single field index", async () => {
    await db.playlistSongs.bulkAdd([
      createPlaylistSong("playlist-1", "song-1", 0),
      createPlaylistSong("playlist-1", "song-2", 1),
      createPlaylistSong("playlist-2", "song-1", 0),
    ]);
    
    // Query by playlistId
    const playlist1Songs = await db.playlistSongs
      .where("playlistId")
      .equals("playlist-1")
      .toArray();
    expect(playlist1Songs.length).toBe(2);
    
    // Query by songId
    const song1Entries = await db.playlistSongs
      .where("songId")
      .equals("song-1")
      .toArray();
    expect(song1Entries.length).toBe(2);
  });

  it("should support filtering by _isDirty flag", async () => {
    const ps1 = { ...createPlaylistSong("playlist-1", "song-1", 0), _isDirty: true };
    const ps2 = { ...createPlaylistSong("playlist-1", "song-2", 1), _isDirty: false };
    const ps3 = { ...createPlaylistSong("playlist-2", "song-1", 0), _isDirty: true };
    
    await db.playlistSongs.bulkAdd([ps1, ps2, ps3]);
    
    // Query dirty records using filter (works consistently across environments)
    const dirtySongs = await db.playlistSongs
      .filter(ps => ps._isDirty === true)
      .toArray();
    
    expect(dirtySongs.length).toBe(2);
  });
});
