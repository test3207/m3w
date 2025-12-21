import { describe, it, expect } from "vitest";
import { getPinyinSort, sortSongsOffline } from "./sorting";
import type { OfflineSong } from "../../db/schema";

// Helper to create mock songs
function createMockSong(overrides: Partial<OfflineSong> = {}): OfflineSong {
  return {
    id: "song-1",
    title: "Test Song",
    artist: "Test Artist",
    album: "Test Album",
    albumArtist: null,
    year: 2024,
    genre: "Pop",
    trackNumber: 1,
    discNumber: 1,
    composer: null,
    fileId: "file-1",
    libraryId: "lib-1",
    libraryName: "My Library",
    duration: 180,
    mimeType: "audio/mpeg",
    isCached: false,
    lastCacheCheck: Date.now(),
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("sorting utilities", () => {
  describe("getPinyinSort", () => {
    it("should return lowercase text", () => {
      expect(getPinyinSort("Hello World")).toBe("hello world");
      expect(getPinyinSort("ABC")).toBe("abc");
    });

    it("should handle Chinese text", () => {
      // The function just lowercases, localeCompare handles pinyin
      expect(getPinyinSort("你好")).toBe("你好");
      expect(getPinyinSort("世界")).toBe("世界");
    });

    it("should handle mixed content", () => {
      expect(getPinyinSort("Hello 你好")).toBe("hello 你好");
    });

    it("should handle empty string", () => {
      expect(getPinyinSort("")).toBe("");
    });
  });

  describe("sortSongsOffline", () => {
    const songs: OfflineSong[] = [
      createMockSong({
        id: "song-1",
        title: "Banana",
        artist: "Charlie",
        album: "Delta",
        createdAt: "2024-01-02T00:00:00.000Z",
      }),
      createMockSong({
        id: "song-2",
        title: "Apple",
        artist: "Alice",
        album: "Beta",
        createdAt: "2024-01-01T00:00:00.000Z",
      }),
      createMockSong({
        id: "song-3",
        title: "Cherry",
        artist: "Bob",
        album: "Alpha",
        createdAt: "2024-01-03T00:00:00.000Z",
      }),
    ];

    it("should not mutate original array", () => {
      const original = [...songs];
      sortSongsOffline(songs, "title-asc");
      expect(songs).toEqual(original);
    });

    describe("title-asc", () => {
      it("should sort by title A-Z", () => {
        const sorted = sortSongsOffline(songs, "title-asc");
        expect(sorted.map((s) => s.title)).toEqual(["Apple", "Banana", "Cherry"]);
      });

      it("should handle Chinese titles with pinyin sorting", () => {
        const chineseSongs = [
          createMockSong({ id: "1", title: "中文" }), // zhongwen
          createMockSong({ id: "2", title: "爱情" }), // aiqing
          createMockSong({ id: "3", title: "北京" }), // beijing
        ];
        const sorted = sortSongsOffline(chineseSongs, "title-asc");
        // localeCompare with zh-CN should sort by pinyin: 爱情, 北京, 中文
        expect(sorted.map((s) => s.title)).toEqual(["爱情", "北京", "中文"]);
      });
    });

    describe("title-desc", () => {
      it("should sort by title Z-A", () => {
        const sorted = sortSongsOffline(songs, "title-desc");
        expect(sorted.map((s) => s.title)).toEqual(["Cherry", "Banana", "Apple"]);
      });
    });

    describe("artist-asc", () => {
      it("should sort by artist A-Z", () => {
        const sorted = sortSongsOffline(songs, "artist-asc");
        expect(sorted.map((s) => s.artist)).toEqual(["Alice", "Bob", "Charlie"]);
      });

      it("should handle null artists (treated as empty string)", () => {
        const songsWithNull = [
          createMockSong({ id: "1", artist: "Zebra" }),
          createMockSong({ id: "2", artist: null }),
          createMockSong({ id: "3", artist: "Apple" }),
        ];
        const sorted = sortSongsOffline(songsWithNull, "artist-asc");
        // Empty string comes first
        expect(sorted.map((s) => s.artist)).toEqual([null, "Apple", "Zebra"]);
      });
    });

    describe("album-asc", () => {
      it("should sort by album A-Z", () => {
        const sorted = sortSongsOffline(songs, "album-asc");
        expect(sorted.map((s) => s.album)).toEqual(["Alpha", "Beta", "Delta"]);
      });

      it("should handle null albums (treated as empty string)", () => {
        const songsWithNull = [
          createMockSong({ id: "1", album: "Zebra" }),
          createMockSong({ id: "2", album: null }),
          createMockSong({ id: "3", album: "Apple" }),
        ];
        const sorted = sortSongsOffline(songsWithNull, "album-asc");
        expect(sorted.map((s) => s.album)).toEqual([null, "Apple", "Zebra"]);
      });
    });

    describe("date-asc", () => {
      it("should sort by date oldest first", () => {
        const sorted = sortSongsOffline(songs, "date-asc");
        expect(sorted.map((s) => s.id)).toEqual(["song-2", "song-1", "song-3"]);
      });
    });

    describe("date-desc", () => {
      it("should sort by date newest first", () => {
        const sorted = sortSongsOffline(songs, "date-desc");
        expect(sorted.map((s) => s.id)).toEqual(["song-3", "song-1", "song-2"]);
      });
    });

    describe("default behavior", () => {
      it("should use date-desc for unknown sort option", () => {
        const sorted = sortSongsOffline(songs, "unknown-option");
        expect(sorted.map((s) => s.id)).toEqual(["song-3", "song-1", "song-2"]);
      });
    });
  });
});
