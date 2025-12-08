/**
 * Libraries Resource Service
 * 
 * @related When modifying API methods, sync these files:
 * - shared/src/api-contracts.ts - Route definitions and offline capability
 * - backend/src/routes/libraries.ts - Backend route handlers
 * - frontend/src/lib/offline-proxy/routes/libraries.ts - Offline proxy handlers
 * - frontend/src/services/api/main/endpoints.ts - Endpoint URL definitions
 */

import { mainApiClient } from "../client";
import { MAIN_API_ENDPOINTS } from "../endpoints";
import type { Library, Song, CreateLibraryInput, UpdateLibraryInput, SongSortOption } from "@m3w/shared";

// Re-export shared types for convenience
export type { CreateLibraryInput, UpdateLibraryInput };

/**
 * Response data for song upload (matches backend: { song })
 */
export interface UploadSongData {
  song: Song & { coverUrl?: string };
}

export const libraries = {
  /**
   * List all libraries
   * Returns libraries with new fields: coverUrl, isDefault, canDelete
   */
  list: async (): Promise<Library[]> => {
    return mainApiClient.get<Library[]>(MAIN_API_ENDPOINTS.libraries.list);
  },

  /**
   * Get library by ID
   */
  getById: async (id: string): Promise<Library> => {
    return mainApiClient.get<Library>(MAIN_API_ENDPOINTS.libraries.detail(id));
  },

  /**
   * Get songs in library with optional sorting
   * @param id - Library ID
   * @param sort - Sort option (date-desc, date-asc, title-asc, title-desc, artist-asc, album-asc)
   */
  getSongs: async (id: string, sort?: SongSortOption): Promise<Song[]> => {
    const url = sort
      ? `${MAIN_API_ENDPOINTS.libraries.songs(id)}?sort=${sort}`
      : MAIN_API_ENDPOINTS.libraries.songs(id);
    return mainApiClient.get<Song[]>(url);
  },

  /**
   * Create new library
   */
  create: async (data: CreateLibraryInput): Promise<Library> => {
    return mainApiClient.post<Library>(MAIN_API_ENDPOINTS.libraries.create, data);
  },

  /**
   * Update library
   */
  update: async (id: string, data: UpdateLibraryInput): Promise<Library> => {
    return mainApiClient.patch<Library>(MAIN_API_ENDPOINTS.libraries.update(id), data);
  },

  /**
   * Delete library
   * Note: Cannot delete default library (canDelete === false)
   */
  delete: async (id: string): Promise<void> => {
    return mainApiClient.delete(MAIN_API_ENDPOINTS.libraries.delete(id));
  },

  /**
   * Upload audio file to library with hash and metadata for deduplication
   * Returns unwrapped data (mainApiClient handles success/error)
   * 
   * Uses RESTful endpoint: POST /api/libraries/:libraryId/songs
   * libraryId is in URL path for early validation before streaming
   * 
   * @param libraryId - Target library ID
   * @param file - Audio file to upload
   * @param hash - SHA256 hash for deduplication
   * @param metadata - Extracted metadata including cover art
   */
  uploadSong: async (
    libraryId: string, 
    file: File, 
    hash: string,
    metadata?: {
      title?: string;
      artist?: string;
      album?: string;
      albumArtist?: string;
      genre?: string;
      composer?: string;
      year?: string;
      trackNumber?: string;
      discNumber?: string;
      duration?: number;
      bitrate?: number;
      sampleRate?: number;
      channels?: number;
      coverBlob?: Blob;
      coverFormat?: string;  // MIME type of cover, e.g., 'image/jpeg', 'image/png'
    }
  ): Promise<UploadSongData> => {
    const formData = new FormData();
    
    // When using webkitdirectory, file.webkitRelativePath contains the folder path
    // We need to ensure only the pure filename is sent to the server
    // Create a new File object with just the filename (no path)
    const pureFileName = file.name;
    const fileToUpload = new File([file], pureFileName, { type: file.type });
    
    formData.append("file", fileToUpload);
    formData.append("hash", hash);
    
    // Append metadata fields if provided
    if (metadata) {
      if (metadata.title) formData.append("title", metadata.title);
      if (metadata.artist) formData.append("artist", metadata.artist);
      if (metadata.album) formData.append("album", metadata.album);
      if (metadata.albumArtist) formData.append("albumArtist", metadata.albumArtist);
      if (metadata.genre) formData.append("genre", metadata.genre);
      if (metadata.composer) formData.append("composer", metadata.composer);
      if (metadata.year) formData.append("year", metadata.year);
      if (metadata.trackNumber) formData.append("trackNumber", metadata.trackNumber);
      if (metadata.discNumber) formData.append("discNumber", metadata.discNumber);
      if (metadata.duration !== undefined) formData.append("duration", metadata.duration.toString());
      if (metadata.bitrate !== undefined) formData.append("bitrate", metadata.bitrate.toString());
      if (metadata.sampleRate !== undefined) formData.append("sampleRate", metadata.sampleRate.toString());
      if (metadata.channels !== undefined) formData.append("channels", metadata.channels.toString());
      
      // Append cover blob if provided
      if (metadata.coverBlob) {
        // Determine file extension from format (e.g., 'image/jpeg' -> 'jpg', 'image/png' -> 'png')
        const coverExt = metadata.coverFormat?.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
        formData.append("cover", metadata.coverBlob, `cover.${coverExt}`);
      }
    }

    return mainApiClient.upload<UploadSongData>(MAIN_API_ENDPOINTS.libraries.uploadSong(libraryId), formData);
  },
};
