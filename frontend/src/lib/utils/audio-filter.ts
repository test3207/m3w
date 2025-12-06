/**
 * Audio file filter utilities
 * 
 * Used to filter audio files from a list of files (e.g., folder selection).
 */

/** Supported audio file extensions (lowercase, with leading dot) */
export const AUDIO_EXTENSIONS = [
  ".mp3",
  ".flac",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".wma",
  ".opus",
  ".aiff",
  ".ape",
  ".alac",
  ".webm",
] as const;

/** Supported audio MIME types */
export const AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/flac",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/x-ms-wma",
  "audio/opus",
  "audio/aiff",
  "audio/x-aiff",
  "audio/ape",
  "audio/webm",
] as const;

/**
 * Check if a file is an audio file
 * Uses both file extension and MIME type for robust detection
 */
export function isAudioFile(file: File): boolean {
  // Check MIME type first (more reliable when available)
  if (file.type && file.type.startsWith("audio/")) {
    return true;
  }
  
  // Fallback to extension check
  const fileName = file.name.toLowerCase();
  const lastDotIndex = fileName.lastIndexOf(".");
  
  if (lastDotIndex === -1) {
    return false;
  }
  
  const extension = fileName.slice(lastDotIndex);
  return (AUDIO_EXTENSIONS as readonly string[]).includes(extension);
}

/**
 * Filter audio files from a file list
 * Returns an object with audio files and skipped count
 */
export function filterAudioFiles(files: File[]): {
  audioFiles: File[];
  skippedCount: number;
} {
  const audioFiles: File[] = [];
  let skippedCount = 0;
  
  for (const file of files) {
    if (isAudioFile(file)) {
      audioFiles.push(file);
    } else {
      skippedCount++;
    }
  }
  
  return { audioFiles, skippedCount };
}

/**
 * Check if the browser supports folder/directory selection
 * (webkitdirectory attribute)
 */
export function isFolderSelectionSupported(): boolean {
  // Check if the browser supports the webkitdirectory attribute
  const input = document.createElement("input");
  return "webkitdirectory" in input;
}

/**
 * Get the base file name from a File object
 * For webkitdirectory uploads, file.name is already the pure filename
 * webkitRelativePath contains the folder path but we don't need it for display
 */
export function getFileName(file: File): string {
  // file.name is always the pure filename, even with webkitdirectory
  return file.name;
}
