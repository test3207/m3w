/**
 * Streaming Upload Service - Three-Phase Approach
 *
 * Phase 1: formidable → PassThrough → MinIO (temp)
 * Phase 2: MinIO stream → parseStream → metadata
 * Phase 3: rename temp → files/{hash}
 */

import { PassThrough, type Readable } from 'node:stream';
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

  const form = formidable({
    maxFileSize: 500 * 1024 * 1024,
    maxFiles: 1,
    hashAlgorithm: 'sha256',
    fileWriteStreamHandler: () => {
      const passThrough = new PassThrough();
      minioClient.putObject(bucketName, tempObjectPath, passThrough);
      return passThrough;
    },
  });

  form.on('fileBegin', (_, file) => {
    mimeType = file.mimetype || 'audio/mpeg';
    originalFilename = file.originalFilename || 'unknown';
  });

  return new Promise((resolve, reject) => {
    form.parse(request, (parseError, fields, files) => {
      if (parseError) return reject(parseError);

      const uploadedFile = files.file?.[0];
      if (!uploadedFile?.hash) return reject(new Error('No file or hash'));

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
    const parsedMetadata = await mm.parseStream(fileStream as unknown as Readable, { mimeType });
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
    fileStream.destroy();
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
    await minioClient.copyObject(bucketName, finalObjectPath, `/${bucketName}/${tempObjectPath}`);
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

  // Phase 2: Extract metadata from uploaded file
  const metadataResult = await extractMetadata(bucketName, tempObjectPath, streamResult.mimeType);

  // Phase 3: Move temp to final hash-based path
  const fileExtension = streamResult.originalFilename.match(/\.[^.]+$/)?.[0]?.toLowerCase() || '';
  const finalObjectPath = await finalizeUpload(bucketName, tempObjectPath, streamResult.hash, fileExtension);

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
  } catch { /* ignore */ }
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

export async function uploadCoverImage(coverImage: CoverImage, fileHash: string, bucketName: string): Promise<string> {
  const imageExtension = coverImage.format === 'image/jpeg' ? 'jpg' : coverImage.format.split('/')[1] || 'bin';
  const coverObjectPath = `covers/${fileHash}.${imageExtension}`;
  await getMinioClient().putObject(bucketName, coverObjectPath, coverImage.buffer, coverImage.buffer.length, {
    'Content-Type': coverImage.format,
  });
  return coverObjectPath;
}
