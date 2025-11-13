/**
 * Shared constants for M3W project
 */

/**
 * Default Resource Type Helpers
 * 
 * Uses isDefault flag to identify default resources (Library/Playlist).
 * Each user has unique IDs generated via cuid(), avoiding multi-user ID conflicts.
 */

// Type guards for Library and Playlist objects
interface LibraryLike {
  isDefault?: boolean;
}

interface PlaylistLike {
  isDefault?: boolean;
}

/**
 * Check if a Library is the default Library
 */
export function isDefaultLibrary(library: LibraryLike): boolean {
  return library.isDefault === true;
}

/**
 * Check if a Playlist is the favorites Playlist
 */
export function isFavoritesPlaylist(playlist: PlaylistLike): boolean {
  return playlist.isDefault === true;
}
