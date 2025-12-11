/**
 * Stream-based file processing utilities
 *
 * Uses ReadableStream.tee() to process a file once while extracting
 * multiple pieces of information (hash, metadata) in parallel.
 * This is memory-efficient as it avoids loading the entire file into memory.
 */

import { parseWebStream, selectCover, type IAudioMetadata } from "music-metadata";
import { calculateHashFromStream } from "./hash";
import { logger } from "../logger-client";

export interface AudioFileInfo {
  hash: string;
  metadata: IAudioMetadata;
  coverBlob: Blob | null;
}

/**
 * Process an audio file using streaming to extract hash and metadata in parallel.
 *
 * This is memory-efficient because:
 * 1. Uses stream.tee() to split the file stream into two
 * 2. Hash calculation processes chunks incrementally
 * 3. Metadata parsing also uses streaming internally
 * 4. Avoids loading the entire file into memory at once.
 *    Note: tee() may buffer data if one consumer is faster than the other.
 *
 * @param file - Audio file to process
 * @returns Hash, metadata, and cover art (if present)
 */
export async function processAudioFileStream(file: File): Promise<AudioFileInfo> {
  const startTime = performance.now();

  // Split the stream for parallel processing
  const [hashStream, metadataStream] = file.stream().tee();

  // Process both in parallel
  const [hash, metadata] = await Promise.all([
    calculateHashFromStream(hashStream),
    parseWebStream(metadataStream, { mimeType: file.type, size: file.size }),
  ]);

  // Extract cover art if present
  let coverBlob: Blob | null = null;
  const cover = selectCover(metadata.common.picture);
  if (cover?.data) {
    // Create new Uint8Array to ensure it's backed by a regular ArrayBuffer
    const coverData = new Uint8Array(cover.data);
    coverBlob = new Blob([coverData], { type: cover.format });
  }

  const duration = performance.now() - startTime;
  logger.info("Processed audio file (streaming)", {
    fileName: file.name,
    fileSize: file.size,
    hash,
    title: metadata.common.title,
    artist: metadata.common.artist,
    hasCover: !!coverBlob,
    durationMs: Math.round(duration),
  });

  return { hash, metadata, coverBlob };
}
