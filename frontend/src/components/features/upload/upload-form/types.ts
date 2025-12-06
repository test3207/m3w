/**
 * Upload feature types
 */

/** Upload status for each file */
export enum UploadStatus {
  Pending = "pending",
  Uploading = "uploading",
  Success = "success",
  Error = "error",
}

/** Individual file upload item */
export interface FileUploadItem {
  file: File;
  status: UploadStatus;
  progress?: number;
  error?: string;
  songTitle?: string;
}

/** Props for UploadSongForm */
export interface UploadSongFormProps {
  onDrawerClose?: () => void;
  targetLibraryId?: string | null;
}
