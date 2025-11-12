/**
 * Upload Resource Service
 */

import { mainApiClient } from '../client';
import { MAIN_API_ENDPOINTS } from '../endpoints';

export interface UploadResponse {
  success: boolean;
  data?: {
    song?: {
      id: string;
      title?: string;
      artist?: string;
      album?: string;
      file?: {
        duration?: number;
        bitrate?: number;
      };
    };
  };
  error?: string;
}

export const upload = {
  /**
   * Upload audio file to library with hash for deduplication
   */
  uploadFile: async (libraryId: string, file: File, hash: string): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('hash', hash);
    formData.append('libraryId', libraryId);

    return mainApiClient.upload<UploadResponse>(MAIN_API_ENDPOINTS.upload.file, formData);
  },
};
