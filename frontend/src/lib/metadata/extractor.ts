import { parseFile, parseBuffer, IAudioMetadata } from 'music-metadata';
import { logger } from '../logger';

/**
 * Extract audio metadata from file path
 */
export async function extractMetadataFromFile(
  filePath: string
): Promise<IAudioMetadata> {
  try {
    const metadata = await parseFile(filePath);
    
    logger.info({
      msg: 'Extracted metadata from file',
      filePath,
      duration: metadata.format.duration,
      bitrate: metadata.format.bitrate,
    });
    
    return metadata;
  } catch (error) {
    logger.error({ msg: 'Error extracting metadata from file', filePath, error });
    throw error;
  }
}

/**
 * Extract audio metadata from buffer
 */
export async function extractMetadataFromBuffer(
  buffer: Buffer,
  mimeType?: string
): Promise<IAudioMetadata> {
  try {
    const metadata = await parseBuffer(buffer, mimeType);
    
    logger.info({
      msg: 'Extracted metadata from buffer',
      size: buffer.length,
      duration: metadata.format.duration,
      bitrate: metadata.format.bitrate,
    });
    
    return metadata;
  } catch (error) {
    logger.error({ msg: 'Error extracting metadata from buffer', error });
    throw error;
  }
}

/**
 * Extract physical properties from metadata
 */
export function extractPhysicalProperties(metadata: IAudioMetadata) {
  return {
    duration: metadata.format.duration
      ? Math.round(metadata.format.duration)
      : null,
    bitrate: metadata.format.bitrate
      ? Math.round(metadata.format.bitrate / 1000)
      : null, // Convert to kbps
    sampleRate: metadata.format.sampleRate || null,
    channels: metadata.format.numberOfChannels || null,
  };
}

/**
 * Extract user-editable metadata from music-metadata result
 */
export function extractUserMetadata(metadata: IAudioMetadata) {
  const common = metadata.common;
  
  return {
    title: common.title || null,
    artist: common.artist || null,
    album: common.album || null,
    albumArtist: common.albumartist || null,
    year: common.year || null,
    genre: common.genre?.[0] || null,
    trackNumber: common.track?.no || null,
    discNumber: common.disk?.no || null,
    composer: common.composer?.[0] || null,
  };
}

/**
 * Generate fallback metadata from filename
 * Used when file has no embedded metadata
 */
export function generateFallbackMetadata(filename: string) {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
  
  // Try pattern 1: Track number - Title (e.g., "01 - Title" or "01. Title")
  const trackPattern = /^\d+\s*[-_.]\s*(.+)$/;
  const trackMatch = nameWithoutExt.match(trackPattern);
  if (trackMatch) {
    return {
      title: trackMatch[1].trim(),
      artist: null,
      album: null,
      albumArtist: null,
      year: null,
      genre: null,
      trackNumber: null,
      discNumber: null,
      composer: null,
    };
  }
  
  // Try pattern 2: Artist - Title (e.g., "Artist - Song Title")
  const artistPattern = /^(.+?)\s*-\s*(.+)$/;
  const artistMatch = nameWithoutExt.match(artistPattern);
  if (artistMatch) {
    return {
      title: artistMatch[2].trim(),
      artist: artistMatch[1].trim(),
      album: null,
      albumArtist: null,
      year: null,
      genre: null,
      trackNumber: null,
      discNumber: null,
      composer: null,
    };
  }
  
  // Fallback: use filename as title
  return {
    title: nameWithoutExt,
    artist: null,
    album: null,
    albumArtist: null,
    year: null,
    genre: null,
    trackNumber: null,
    discNumber: null,
    composer: null,
  };
}

/**
 * Extract cover art from metadata
 */
export function extractCoverArt(metadata: IAudioMetadata): Buffer | null {
  const picture = metadata.common.picture?.[0];
  
  if (picture) {
    logger.debug({
      msg: 'Extracted cover art',
      format: picture.format,
      size: picture.data.length,
    });
    return Buffer.from(picture.data);
  }
  
  return null;
}
