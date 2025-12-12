/**
 * Audio Format Utilities
 *
 * MIME type mapping and format detection for audio files.
 * Used by AudioPlayer to determine correct format for Howler.js.
 */

/**
 * MIME type to Howler.js format mapping
 */
export const MIME_TYPE_TO_FORMAT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mpeg3": "mp3",
  "audio/x-mp3": "mp3",
  "audio/aac": "aac",
  "audio/aacp": "aac",
  "audio/mp4": "mp4",
  "audio/x-m4a": "m4a",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/webm": "webm",
  "audio/3gpp": "3gp",
  "audio/3gpp2": "3g2",
};

/**
 * Extract file extension from URL
 */
export function extractExtensionFromUrl(url: string): string | null {
  const sanitized = url.split("?")[0];
  const lastSegment = sanitized.split("/").pop();
  if (!lastSegment) {
    return null;
  }

  const dotIndex = lastSegment.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === lastSegment.length - 1) {
    return null;
  }

  return lastSegment.slice(dotIndex + 1).toLowerCase();
}

/**
 * Track interface for format resolution
 */
interface TrackForFormat {
  audioUrl: string;
  mimeType?: string;
}

/**
 * Resolve audio format for Howler.js
 * Returns array of format strings or undefined to let Howler auto-detect
 */
export function resolveAudioFormat(track: TrackForFormat): string[] | undefined {
  const mimeType = track.mimeType?.toLowerCase();
  
  if (mimeType) {
    // Try direct mapping first
    const mapped = MIME_TYPE_TO_FORMAT[mimeType];
    if (mapped) {
      return [mapped];
    }

    // Try extracting subtype from MIME type
    if (mimeType.startsWith("audio/")) {
      const subtype = mimeType.split("/")[1]?.split(";")[0]?.split("+")[0];
      if (subtype) {
        return [subtype];
      }
    }
  }

  // Fallback to URL extension
  const extension = extractExtensionFromUrl(track.audioUrl);
  if (extension) {
    return [extension];
  }

  // Let Howler auto-detect
  return undefined;
}
