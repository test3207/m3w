/**
 * Safe re-exports from @m3w/shared
 *
 * WHY THIS FILE EXISTS:
 * The main @m3w/shared entry pulls in Zod (~30KB) even when only importing
 * types or constants. This file re-exports commonly used items from their
 * specific subpaths to enable tree-shaking.
 *
 * USAGE RULE:
 * - In core modules (stores, lib/api, providers): import from "@/lib/shared"
 * - In lazy-loaded modules (pages, offline-proxy): import from "@m3w/shared" directly
 *
 * This keeps the main bundle small while maintaining readable imports.
 */

// Types (runtime values that are type-safe enums)
export { RepeatMode } from "@m3w/shared/types";

// Constants (pure functions, no dependencies)
export { isDefaultLibrary, isFavoritesPlaylist } from "@m3w/shared/constants";

// API contracts (route definitions, no Zod)
export { isOfflineCapable, getCacheConfig } from "@m3w/shared/api-contracts";

// Re-export all types (these are compile-time only, zero runtime cost)
export type {
  // Core entities
  Library,
  Playlist,
  Song,
  User,
  PlaylistSong,
  // API types
  ApiResponse,
  AuthTokens,
  // Input types
  CreateLibraryInput,
  UpdateLibraryInput,
  CreatePlaylistInput,
  UpdatePlaylistInput,
  UpdateSongInput,
  // Other types
  SongSortOption,
  UserPreferences,
  StorageUsageInfo,
  ProgressSyncResult,
  PreferencesUpdateResult,
  PlaylistReorderResult,
  SongSearchParams,
  SongPlaylistCount,
} from "@m3w/shared";
