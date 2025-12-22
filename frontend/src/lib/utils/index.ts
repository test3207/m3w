/**
 * Utility Functions Index
 * Re-exports all utility functions for convenient imports
 */

// Tailwind CSS class name utilities
export { cn } from "./cn";

// Duration formatting
export { formatDuration } from "./format-duration";

// NOTE: Hash utilities (calculateFileHash, calculateBufferHash) are NOT exported here
// to avoid pulling @aws-crypto/sha256-browser (~15KB) into main bundle.
// Import directly from "@/lib/utils/hash" when needed.

// UUID utilities (with fallback for non-secure contexts)
export { generateUUID } from "./uuid";

// Audio file filter utilities
export { isAudioFile, filterAudioFiles, isFolderSelectionSupported, getFileName, AUDIO_EXTENSIONS, AUDIO_MIME_TYPES } from "./audio-filter";
