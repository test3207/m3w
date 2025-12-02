/**
 * Soft Delete Filter Tests
 * Tests that soft-deleted entities (_isDeleted=true) are properly filtered
 * from GET queries. These tests verify the filtering logic directly.
 */

import { describe, it, expect } from 'vitest';

// Test types matching the schema
interface SyncTrackingFields {
  _isDirty?: boolean;
  _isDeleted?: boolean;
  _isLocalOnly?: boolean;
  _lastModifiedAt?: number;
}

interface MockLibrary extends SyncTrackingFields {
  id: string;
  name: string;
  userId: string;
}

interface MockSong extends SyncTrackingFields {
  id: string;
  title: string;
  libraryId: string;
  coverUrl: string | null;
  createdAt: string;
}

interface MockPlaylist extends SyncTrackingFields {
  id: string;
  name: string;
  userId: string;
  linkedLibraryId: string | null;
}

interface MockPlaylistSong extends SyncTrackingFields {
  id: string;
  playlistId: string;
  songId: string;
  order: number;
}

// Helper to create mock data
const createMockLibrary = (id: string, name: string, isDeleted = false): MockLibrary => ({
  id,
  name,
  userId: 'test-user',
  _isDeleted: isDeleted,
});

const createMockSong = (id: string, libraryId: string, title: string, isDeleted = false): MockSong => ({
  id,
  title,
  libraryId,
  coverUrl: `http://example.com/cover-${id}.jpg`,
  createdAt: new Date().toISOString(),
  _isDeleted: isDeleted,
});

const createMockPlaylist = (id: string, name: string, linkedLibraryId: string | null = null, isDeleted = false): MockPlaylist => ({
  id,
  name,
  userId: 'test-user',
  linkedLibraryId,
  _isDeleted: isDeleted,
});

const createMockPlaylistSong = (id: string, playlistId: string, songId: string, order: number, isDeleted = false): MockPlaylistSong => ({
  id,
  playlistId,
  songId,
  order,
  _isDeleted: isDeleted,
});

/**
 * Filter function that matches the pattern used in offline-proxy routes
 * This is the core logic being tested
 */
const filterDeleted = <T extends SyncTrackingFields>(items: T[]): T[] => {
  return items.filter(item => !item._isDeleted);
};

describe('Soft Delete Filter - Core Logic', () => {
  describe('filterDeleted helper', () => {
    it('should exclude items with _isDeleted=true', () => {
      const items = [
        { id: '1', _isDeleted: false },
        { id: '2', _isDeleted: true },
        { id: '3', _isDeleted: false },
      ];
      
      const result = filterDeleted(items);
      
      expect(result).toHaveLength(2);
      expect(result.map(i => i.id)).toEqual(['1', '3']);
    });

    it('should include items with _isDeleted=undefined or false', () => {
      const items = [
        { id: '1' },  // undefined
        { id: '2', _isDeleted: false },
        { id: '3', _isDeleted: undefined },
      ];
      
      const result = filterDeleted(items);
      
      expect(result).toHaveLength(3);
    });

    it('should return empty array when all items are deleted', () => {
      const items = [
        { id: '1', _isDeleted: true },
        { id: '2', _isDeleted: true },
      ];
      
      const result = filterDeleted(items);
      
      expect(result).toHaveLength(0);
    });
  });
});

describe('Soft Delete Filter - Libraries', () => {
  it('should exclude soft-deleted libraries from list', () => {
    const libraries = [
      createMockLibrary('lib-1', 'Active Library 1'),
      createMockLibrary('lib-2', 'Active Library 2'),
      createMockLibrary('lib-deleted', 'Deleted Library', true),
    ];
    
    const result = filterDeleted(libraries);
    
    expect(result).toHaveLength(2);
    expect(result.map(l => l.id)).toContain('lib-1');
    expect(result.map(l => l.id)).toContain('lib-2');
    expect(result.map(l => l.id)).not.toContain('lib-deleted');
  });

  it('should correctly count non-deleted songs per library', () => {
    const songs = [
      createMockSong('song-1', 'lib-1', 'Active Song 1'),
      createMockSong('song-2', 'lib-1', 'Active Song 2'),
      createMockSong('song-deleted', 'lib-1', 'Deleted Song', true),
    ];
    
    const activeSongs = filterDeleted(songs);
    const songCount = activeSongs.filter(s => s.libraryId === 'lib-1').length;
    
    // Should count only 2 active songs, not the deleted one
    expect(songCount).toBe(2);
  });

  it('should use cover from non-deleted song for library', () => {
    const songs = [
      createMockSong('song-old', 'lib-1', 'Old Song'),
      createMockSong('song-deleted', 'lib-1', 'Deleted Song (newest)', true),
    ];
    // Make deleted song appear "newest"
    songs[1].createdAt = new Date(Date.now() + 1000).toISOString();
    
    const activeSongs = filterDeleted(songs);
    const sortedSongs = activeSongs.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const lastSong = sortedSongs[0];
    
    // Should use song-old's cover, not song-deleted's cover
    expect(lastSong?.id).toBe('song-old');
    expect(lastSong?.coverUrl).toBe('http://example.com/cover-song-old.jpg');
  });

  it('should treat soft-deleted library as not found', () => {
    const library = createMockLibrary('lib-1', 'Deleted Library', true);
    
    // Simulating the check: if (!library || library._isDeleted)
    const isNotFound = !library || library._isDeleted;
    
    expect(isNotFound).toBe(true);
  });
});

describe('Soft Delete Filter - Songs', () => {
  it('should treat soft-deleted song as not found', () => {
    const song = createMockSong('song-1', 'lib-1', 'Deleted Song', true);
    
    // Simulating the check: if (!song || song._isDeleted)
    const isNotFound = !song || song._isDeleted;
    
    expect(isNotFound).toBe(true);
  });

  it('should return active song normally', () => {
    const song = createMockSong('song-1', 'lib-1', 'Active Song', false);
    
    const isNotFound = !song || song._isDeleted;
    
    expect(isNotFound).toBe(false);
  });
});

describe('Soft Delete Filter - Playlists', () => {
  it('should exclude soft-deleted playlists from list', () => {
    const playlists = [
      createMockPlaylist('pl-1', 'Active Playlist'),
      createMockPlaylist('pl-2', 'Linked Playlist', 'lib-1'),
      createMockPlaylist('pl-deleted', 'Deleted Playlist', null, true),
      createMockPlaylist('pl-linked-deleted', 'Deleted Linked Playlist', 'lib-1', true),
    ];
    
    const result = filterDeleted(playlists);
    
    expect(result).toHaveLength(2);
    expect(result.map(p => p.id)).not.toContain('pl-deleted');
    expect(result.map(p => p.id)).not.toContain('pl-linked-deleted');
  });

  it('should exclude soft-deleted playlistSongs from count', () => {
    const playlistSongs = [
      createMockPlaylistSong('ps-1', 'pl-1', 'song-1', 1),
      createMockPlaylistSong('ps-2', 'pl-1', 'song-2', 2),
      createMockPlaylistSong('ps-deleted', 'pl-1', 'song-3', 3, true),
    ];
    
    const activeSongs = filterDeleted(playlistSongs);
    const songCount = activeSongs.filter(ps => ps.playlistId === 'pl-1').length;
    
    // Should count only 2, not 3
    expect(songCount).toBe(2);
  });

  it('should treat soft-deleted playlist as not found', () => {
    const playlist = createMockPlaylist('pl-1', 'Deleted Playlist', null, true);
    
    const isNotFound = !playlist || playlist._isDeleted;
    
    expect(isNotFound).toBe(true);
  });

  it('should find active linked playlist excluding soft-deleted ones', () => {
    const playlists = [
      createMockPlaylist('pl-deleted', 'Deleted Linked', 'lib-1', true),
      createMockPlaylist('pl-active', 'Active Linked', 'lib-1', false),
    ];
    
    // Simulating: filter then find
    const activeLinked = filterDeleted(playlists).find(p => p.linkedLibraryId === 'lib-1');
    
    expect(activeLinked?.id).toBe('pl-active');
  });
});

describe('Soft Delete Filter - Playlist Songs List', () => {
  it('should exclude soft-deleted playlistSongs from songs list', () => {
    const playlistSongs = [
      createMockPlaylistSong('ps-1', 'pl-1', 'song-1', 1),
      createMockPlaylistSong('ps-2', 'pl-1', 'song-2', 2),
      createMockPlaylistSong('ps-deleted', 'pl-1', 'song-3', 3, true),
    ];
    
    const activePsLinks = filterDeleted(playlistSongs);
    
    expect(activePsLinks).toHaveLength(2);
    expect(activePsLinks.map(ps => ps.songId)).toContain('song-1');
    expect(activePsLinks.map(ps => ps.songId)).toContain('song-2');
    expect(activePsLinks.map(ps => ps.songId)).not.toContain('song-3');
  });

  it('should also exclude songs that are soft-deleted', () => {
    const songs = [
      createMockSong('song-1', 'lib-1', 'Song 1'),
      createMockSong('song-2', 'lib-1', 'Song 2'),
      createMockSong('song-soft-deleted', 'lib-1', 'Soft Deleted Song', true),
    ];
    
    const playlistSongs = [
      createMockPlaylistSong('ps-1', 'pl-1', 'song-1', 1),
      createMockPlaylistSong('ps-2', 'pl-1', 'song-2', 2),
      createMockPlaylistSong('ps-3', 'pl-1', 'song-soft-deleted', 3), // link to deleted song
    ];
    
    // First filter playlistSongs, then filter out songs that are deleted
    const activePsLinks = filterDeleted(playlistSongs);
    const activeSongs = filterDeleted(songs);
    const activeSongIds = new Set(activeSongs.map(s => s.id));
    
    // Get songs that have active links AND are not deleted
    const finalSongIds = activePsLinks
      .map(ps => ps.songId)
      .filter(songId => activeSongIds.has(songId));
    
    expect(finalSongIds).toHaveLength(2);
    expect(finalSongIds).toContain('song-1');
    expect(finalSongIds).toContain('song-2');
    expect(finalSongIds).not.toContain('song-soft-deleted');
  });

  it('should sort active playlistSongs by order', () => {
    const playlistSongs = [
      createMockPlaylistSong('ps-3', 'pl-1', 'song-3', 3),
      createMockPlaylistSong('ps-1', 'pl-1', 'song-1', 1),
      createMockPlaylistSong('ps-deleted', 'pl-1', 'song-x', 2, true),
      createMockPlaylistSong('ps-2', 'pl-1', 'song-2', 4),
    ];
    
    const activeSorted = filterDeleted(playlistSongs).sort((a, b) => a.order - b.order);
    
    expect(activeSorted.map(ps => ps.songId)).toEqual(['song-1', 'song-3', 'song-2']);
  });
});

describe('Soft Delete Filter - Cover URL with Deleted Songs', () => {
  it('should skip soft-deleted song when getting cover', () => {
    const songs = new Map([
      ['song-1', createMockSong('song-1', 'lib-1', 'Active Song')],
      ['song-deleted', createMockSong('song-deleted', 'lib-1', 'Deleted Song', true)],
    ]);
    
    const playlistSongs = [
      createMockPlaylistSong('ps-1', 'pl-1', 'song-deleted', 1), // first by order, but deleted
      createMockPlaylistSong('ps-2', 'pl-1', 'song-1', 2),
    ];
    
    // Simulating the cover URL logic
    const activePsLinks = filterDeleted(playlistSongs).sort((a, b) => a.order - b.order);
    
    let coverUrl: string | null = null;
    for (const ps of activePsLinks) {
      const song = songs.get(ps.songId);
      if (song && !song._isDeleted) {
        coverUrl = song.coverUrl;
        break;
      }
    }
    
    // Should use song-1's cover, not song-deleted's
    expect(coverUrl).toBe('http://example.com/cover-song-1.jpg');
  });
});
