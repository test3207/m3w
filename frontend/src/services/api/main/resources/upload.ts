/**
 * Upload Resource Service
 */

import { mainApiClient } from '../client';
import { MAIN_API_ENDPOINTS } from '../endpoints';

export interface UploadData {
  song: {
    id: string;
    title: string;
    artist?: string;
    album?: string;
    file?: {
      duration?: number;
      bitrate?: number;
    };
  };
  file: {
    id: string;
    hash: string;
    duration?: number;
  };
  isNewFile: boolean;
}

export const upload = {
  /**
   * Upload audio file to library with hash for deduplication
   * Returns unwrapped data (mainApiClient handles success/error)
   */
  uploadFile: async (libraryId: string, file: File, hash: string): Promise<UploadData> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('hash', hash);
    formData.append('libraryId', libraryId);

    return mainApiClient.upload<UploadData>(MAIN_API_ENDPOINTS.upload.file, formData);
  },
};
