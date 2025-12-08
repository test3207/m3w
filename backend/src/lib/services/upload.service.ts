/**
 * Streaming Upload Service - Three-Phase Approach
 *
 * Phase 1: Stream file to MinIO temp location via formidable
 * Phase 2: Verify hash and extract metadata from MinIO stream (parseStream)
 * Phase 3: Rename temp → files/{hash} with deduplication
 *
 * Benefits: No buffering in memory, cleaner separation of concerns
 */

import { PassThrough } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import crypto from 'node:crypto';
import formidable from 'formidable';
import * as mm from 'music-metadata';
import { getMinioClient } from '../minio-client';
import { logger } from '../logger';

// ============================================================================
// Types
// ============================================================================

export interface UploadFormFields {
  hash?: string;
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  composer?: string;
  coverUrl?: string;
  year?: string;
  trackNumber?: string;
  discNumber?: string;
}

export interface AudioMetadata {
  duration?: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
}

export interface CoverImage {
  buffer: Buffer;
  format: string;
}

export interface StreamingUploadResult {
  hash: string;
  objectName: string;
  size: number;
  mimeType: string;
  metadata: AudioMetadata;
  coverImage: CoverImage | null;
  originalFilename: string;
}

export interface ParsedUpload {
  fields: UploadFormFields;
  file: StreamingUploadResult;
}

// ============================================================================
// Phase 1: Stream to MinIO
// ============================================================================

interface StreamUploadResult {
  tempPath: string;
  hash: string;
  size: number;
  mimeType: string;
  originalFilename: string;
  fields: UploadFormFields;
}

function streamToMinIO(request: IncomingMessage, bucketName: string, tempObjectPath: string): Promise<StreamUploadResult> {
  const minioClient = getMinioClient();
  let mimeType = '';
  let originalFilename = '';
  let uploadPromise: Promise<unknown> | null = null;

  const form = formidable({
    maxFileSize: 500 * 1024 * 1024,
    maxFiles: 1,
    maxFields: 20,
    allowEmptyFiles: false,
    hashAlgorithm: 'sha256',
    fileWriteStreamHandler: () => {
      const passThrough = new PassThrough();
      // Store promise to await after parse completes
      uploadPromise = minioClient.putObject(bucketName, tempObjectPath, passThrough);
      return passThrough;
    },
  });

  return new Promise((resolve, reject) => {
    // Register event handlers before parsing to avoid race conditions
    form.on('fileBegin', (_, file) => {
      mimeType = file.mimetype || 'audio/mpeg';
      originalFilename = file.originalFilename || 'unknown';
    });

    // Note: formidable's error event automatically calls parse callback with error,
    // so cleanup is handled in the callback to avoid double cleanup

    form.parse(request, async (parseError, fields, files) => {
      if (parseError) {
        await cleanupTempObject(bucketName, tempObjectPath);
        return reject(parseError);
      }

      const uploadedFile = files.file?.[0];
      if (!uploadedFile) {
        await cleanupTempObject(bucketName, tempObjectPath);
        return reject(new Error('File upload failed: no file received'));
      }
      if (!uploadedFile.hash) {
        await cleanupTempObject(bucketName, tempObjectPath);
        return reject(new Error('File upload failed: hash calculation missing'));
      }

      // Wait for MinIO upload to actually complete
      if (uploadPromise) {
        try {
          await uploadPromise;
        } catch (err) {
          await cleanupTempObject(bucketName, tempObjectPath);
          return reject(new Error(`MinIO upload failed: ${err instanceof Error ? err.message : String(err)}`));
        }
      }

      resolve({
        tempPath: tempObjectPath,
        hash: uploadedFile.hash,
        size: uploadedFile.size,
        mimeType,
        originalFilename,
        fields: extractFields(fields),
      });
    });
  });
}

// ============================================================================
// Phase 2: Extract Metadata
// ============================================================================

interface ExtractedMetadataResult {
  metadata: AudioMetadata;
  coverImage: CoverImage | null;
}

async function extractMetadata(bucketName: string, objectPath: string, mimeType: string): Promise<ExtractedMetadataResult> {
  const fileStream = await getMinioClient().getObject(bucketName, objectPath);

  try {
    const parsedMetadata = await mm.parseStream(fileStream, { mimeType });
    const coverArt = parsedMetadata.common.picture?.[0];

    return {
      metadata: {
        duration: parsedMetadata.format.duration ? Math.floor(parsedMetadata.format.duration) : undefined,
        bitrate: parsedMetadata.format.bitrate ? Math.floor(parsedMetadata.format.bitrate / 1000) : undefined,
        sampleRate: parsedMetadata.format.sampleRate,
        channels: parsedMetadata.format.numberOfChannels,
      },
      coverImage: coverArt ? { buffer: Buffer.from(coverArt.data), format: coverArt.format } : null,
    };
  } catch (error) {
    logger.warn({ error }, 'Metadata extraction failed');
    return { metadata: {}, coverImage: null };
  } finally {
    if (!fileStream.destroyed) {
      fileStream.destroy();
    }
  }
}

// ============================================================================
// Phase 3: Finalize (rename temp → files/{hash})
// ============================================================================

async function finalizeUpload(bucketName: string, tempObjectPath: string, fileHash: string, fileExtension: string): Promise<string> {
  const minioClient = getMinioClient();
  const finalObjectPath = `files/${fileHash}${fileExtension}`;

  try {
    await minioClient.statObject(bucketName, finalObjectPath);
    // Already exists (dedup)
  } catch {
    // Doesn't exist, copy
    try {
      await minioClient.copyObject(bucketName, finalObjectPath, `/${bucketName}/${tempObjectPath}`);
    } catch (copyError) {
      // Race condition: another upload may have completed
      try {
        await minioClient.statObject(bucketName, finalObjectPath);
        // File exists now, proceed with cleanup
      } catch {
        // Copy genuinely failed
        throw new Error(`Failed to finalize upload: ${copyError instanceof Error ? copyError.message : String(copyError)}`);
      }
    }
  }

  await cleanupTempObject(bucketName, tempObjectPath);
  return finalObjectPath;
}

// ============================================================================
// Main Entry Point
// ============================================================================

export async function parseStreamingUpload(request: IncomingMessage, bucketName: string): Promise<ParsedUpload> {
  const minioClient = getMinioClient();

  // Ensure bucket exists
  if (!(await minioClient.bucketExists(bucketName))) {
    await minioClient.makeBucket(bucketName);
  }

  const tempObjectPath = `temp/${crypto.randomUUID()}`;

  // Phase 1: Stream file to MinIO temp location
  const streamResult = await streamToMinIO(request, bucketName, tempObjectPath);

  // Verify hash if frontend provided one
  if (streamResult.fields.hash && streamResult.fields.hash !== streamResult.hash) {
    logger.warn(
      { frontendHash: streamResult.fields.hash, actualHash: streamResult.hash },
      'Hash mismatch'
    );
    await cleanupTempObject(bucketName, tempObjectPath);
    throw new Error('File integrity check failed');
  }

  // Validate MIME type
  if (!streamResult.mimeType) {
    await cleanupTempObject(bucketName, tempObjectPath);
    throw new Error('Failed to determine file MIME type');
  }

  // Phase 2: Extract metadata from uploaded file
  let metadataResult;
  try {
    metadataResult = await extractMetadata(bucketName, tempObjectPath, streamResult.mimeType);
  } catch (err) {
    await cleanupTempObject(bucketName, tempObjectPath);
    throw err;
  }

  // Phase 3: Move temp to final hash-based path
  const fileExtension = streamResult.originalFilename.match(/\.[^.]+$/)?.[0]?.toLowerCase() || '';
  const finalObjectPath = await finalizeUpload(bucketName, tempObjectPath, streamResult.hash, fileExtension);

  logger.info(
    { objectName: finalObjectPath, size: streamResult.size },
    'File uploaded to MinIO'
  );

  return {
    fields: streamResult.fields,
    file: {
      hash: streamResult.hash,
      objectName: finalObjectPath,
      size: streamResult.size,
      mimeType: streamResult.mimeType,
      metadata: metadataResult.metadata,
      coverImage: metadataResult.coverImage,
      originalFilename: streamResult.originalFilename,
    },
  };
}

// ============================================================================
// Helpers
// ============================================================================

async function cleanupTempObject(bucketName: string, objectPath: string) {
  try {
    await getMinioClient().removeObject(bucketName, objectPath);
  } catch (error) {
    logger.warn({ error, objectPath }, 'Failed to cleanup temp object');
  }
}

function extractFields(fields: formidable.Fields): UploadFormFields {
  const getFieldValue = (key: string): string | undefined => {
    const value = fields[key];
    if (Array.isArray(value)) return value[0];
    if (typeof value === 'string') return value;
    return undefined;
  };
  return {
    hash: getFieldValue('hash'),
    title: getFieldValue('title'),
    artist: getFieldValue('artist'),
    album: getFieldValue('album'),
    albumArtist: getFieldValue('albumArtist'),
    genre: getFieldValue('genre'),
    composer: getFieldValue('composer'),
    coverUrl: getFieldValue('coverUrl'),
    year: getFieldValue('year'),
    trackNumber: getFieldValue('trackNumber'),
    discNumber: getFieldValue('discNumber'),
  };
}

function getExtensionFromMimeType(mimeType: string): string {
  const subtype = mimeType.split('/')[1]?.split(';')[0]?.trim();
  if (subtype === 'jpeg') return 'jpg';
  return subtype || 'bin';
}

export async function uploadCoverImage(coverImage: CoverImage, fileHash: string, bucketName: string): Promise<string> {
  const imageExtension = getExtensionFromMimeType(coverImage.format);
  const coverObjectPath = `covers/${fileHash}.${imageExtension}`;
  await getMinioClient().putObject(bucketName, coverObjectPath, coverImage.buffer, coverImage.buffer.length, {
    'Content-Type': coverImage.format,
  });
  logger.info({ coverObjectPath, fileHash }, 'Cover image uploaded to MinIO');
  return coverObjectPath;
}
