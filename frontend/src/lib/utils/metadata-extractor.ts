/**
 * Audio Metadata Extraction Utility
 * 
 * Extracts complete metadata from audio files including:
 * - Basic metadata (title, artist, album, etc.)
 * - Technical metadata (duration, bitrate, sampleRate, channels)
 * - Cover art as Blob
 */

import { parseBlob } from "music-metadata";
import { logger } from "@/lib/logger-client";

export interface ExtractedMetadata {
  // User-editable metadata
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  composer?: string;
  year?: string;
  trackNumber?: string;
  discNumber?: string;
  
  // Technical metadata (from format)
  duration?: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  
  // Cover art
  coverBlob?: Blob;
  coverFormat?: string;
}

/**
 * Extract all metadata from audio file including cover art
 * Used by frontend before upload to send complete metadata to backend
 */
export async function extractAudioMetadata(file: File): Promise<ExtractedMetadata> {
  try {
    const metadata = await parseBlob(file);
    const { common, format } = metadata;
    
    const result: ExtractedMetadata = {
      // User-editable metadata from ID3 tags
      title: common.title,
      artist: common.artist,
      album: common.album,
      albumArtist: common.albumartist,
      genre: common.genre && common.genre.length > 0 ? common.genre[0] : undefined,
      composer: common.composer && common.composer.length > 0 ? common.composer[0] : undefined,
      year: common.year?.toString(),
      trackNumber: common.track.no?.toString(),
      discNumber: common.disk.no?.toString(),
      
      // Technical metadata from audio format
      duration: format.duration ? Math.floor(format.duration) : undefined,
      bitrate: format.bitrate ? Math.floor(format.bitrate / 1000) : undefined, // Convert to kbps
      sampleRate: format.sampleRate,
      channels: format.numberOfChannels,
    };
    
    // Extract cover art if available
    if (common.picture && common.picture.length > 0) {
      const picture = common.picture[0];
      result.coverBlob = new Blob([new Uint8Array(picture.data)], {
        type: picture.format,
      });
      result.coverFormat = picture.format;
      
      logger.info("Cover art extracted", {
        format: picture.format,
        size: result.coverBlob.size,
      });
    }
    
    return result;
  } catch (error) {
    logger.error("Failed to extract metadata", error);
    throw new Error("Failed to extract metadata from audio file");
  }
}
