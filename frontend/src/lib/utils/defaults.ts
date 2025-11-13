/**
 * Default Resources Utilities
 * Helper functions for handling default library and favorites playlist
 */

import { I18n } from '@/locales/i18n';
import { isDefaultLibrary, isFavoritesPlaylist } from '@m3w/shared';
import type { Library, Playlist } from '@m3w/shared';

/**
 * Get display name for a library
 * If it's the default library, return i18n translated name
 * Otherwise return the database name
 */
export function getLibraryDisplayName(library: Library): string {
  if (isDefaultLibrary(library)) {
    return I18n.defaults.library.name;
  }
  return library.name;
}

/**
 * Get display name for a playlist
 * If it's the favorites playlist, return i18n translated name
 * Otherwise return the database name
 */
export function getPlaylistDisplayName(playlist: Playlist): string {
  if (isFavoritesPlaylist(playlist)) {
    return I18n.defaults.playlist.name;
  }
  return playlist.name;
}

/**
 * Get badge text for a library
 * Returns translated badge text for default library
 */
export function getLibraryBadge(library: Library): string | null {
  if (isDefaultLibrary(library)) {
    return I18n.defaults.library.badge;
  }
  return null;
}

/**
 * Get badge text for a playlist
 * Returns translated badge text for favorites playlist
 */
export function getPlaylistBadge(playlist: Playlist): string | null {
  if (isFavoritesPlaylist(playlist)) {
    return I18n.defaults.playlist.badge;
  }
  return null;
}

/**
 * Check if user can delete a library
 * Default library cannot be deleted
 */
export function canDeleteLibrary(library: Library): boolean {
  if (isDefaultLibrary(library)) {
    return false;
  }
  return library.canDelete ?? true;
}

/**
 * Check if user can delete a playlist
 * Favorites playlist cannot be deleted
 */
export function canDeletePlaylist(playlist: Playlist): boolean {
  if (isFavoritesPlaylist(playlist)) {
    return false;
  }
  return playlist.canDelete ?? true;
}
