/**
 * Upload entity types
 * Handles file upload operations
 */

import type { Song } from './song';

// ============================================================
// Upload API Response Types
// ============================================================

/**
 * Upload result data
 * Used by POST /api/upload
 */
export interface UploadResult {
  song: Song;
  isDuplicate?: boolean;
  /** File entity (only from backend, not offline) */
  file?: {
    id: string;
    hash: string;
    size: number;
    mimeType: string;
    duration?: number;
  };
  /** Whether a new file was created (only from backend) */
  isNewFile?: boolean;
}
