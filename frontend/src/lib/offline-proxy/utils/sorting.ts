/**
 * Sorting utilities for offline-proxy
 * Mirrors backend sorting logic for consistency
 */

import type { OfflineSong } from "../../db/schema";
import type { SongSortOption } from "@m3w/shared";

/**
 * Get pinyin sort key for Chinese text
 * 
 * Uses localeCompare with 'zh-CN' locale for native pinyin sorting.
 * This approach is simpler than importing a full pinyin library.
 * 
 * @param text - Text to normalize for sorting
 * @returns Lowercase text for localeCompare
 */
export function getPinyinSort(text: string): string {
  // For Chinese text, use the text as-is for localeCompare
  // localeCompare with 'zh-CN' locale will handle pinyin sorting
  return text.toLowerCase();
}

/**
 * Sort songs by various options (mirrors backend sort logic)
 * 
 * Supports 6 sorting options aligned with backend `songs.ts`:
 * - `title-asc`: Title A-Z (Chinese sorted by Pinyin via localeCompare 'zh-CN')
 * - `title-desc`: Title Z-A
 * - `artist-asc`: Artist A-Z (null artists treated as empty string)
 * - `album-asc`: Album A-Z (null albums treated as empty string)
 * - `date-asc`: Date added (oldest first)
 * - `date-desc`: Date added (newest first) - DEFAULT
 * 
 * @param songs - Array of songs to sort (not mutated, returns new array)
 * @param sortOption - Sort option string from SongSortOption
 * @returns New sorted array of songs
 * 
 * @example
 * // Sort by title ascending (Pinyin for Chinese)
 * const sorted = sortSongsOffline(songs, 'title-asc');
 * 
 * @see backend/src/routes/songs.ts - sortSongs() for backend equivalent
 * @see shared/src/types.ts - SongSortOption type definition
 */
export function sortSongsOffline(
  songs: OfflineSong[],
  sortOption: SongSortOption | string
): OfflineSong[] {
  const sorted = [...songs];

  switch (sortOption) {
    case "title-asc":
      return sorted.sort((a, b) => {
        const aTitle = getPinyinSort(a.title);
        const bTitle = getPinyinSort(b.title);
        return aTitle.localeCompare(bTitle, "zh-CN");
      });

    case "title-desc":
      return sorted.sort((a, b) => {
        const aTitle = getPinyinSort(a.title);
        const bTitle = getPinyinSort(b.title);
        return bTitle.localeCompare(aTitle, "zh-CN");
      });

    case "artist-asc":
      return sorted.sort((a, b) => {
        const aArtist = getPinyinSort(a.artist || "");
        const bArtist = getPinyinSort(b.artist || "");
        return aArtist.localeCompare(bArtist, "zh-CN");
      });

    case "album-asc":
      return sorted.sort((a, b) => {
        const aAlbum = getPinyinSort(a.album || "");
        const bAlbum = getPinyinSort(b.album || "");
        return aAlbum.localeCompare(bAlbum, "zh-CN");
      });

    case "date-asc":
      return sorted.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

    case "date-desc":
    default:
      return sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }
}
