/**
 * Streaming Upload Service
 *
 * Implements streaming file upload with:
 * - Direct streaming to MinIO (no head buffering)
 * - SHA256 hash calculation during streaming (via formidable)
 * - Metadata provided by frontend via FormData
 * - Cover art provided by frontend as separate blob
 *
 * Refactored: Metadata extraction moved to frontend
 * @see https://github.com/test3207/m3w/issues/125
 */

import { PassThrough } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import crypto from 'node:crypto';
import formidable from 'formidable';
import type VolatileFile from 'formidable/VolatileFile';
import { getMinioClient } from '../minio-client';
import { logger } from '../logger';

// ============================================================================
// Constants
// ============================================================================

/** Maximum file size (500MB) */
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// ============================================================================
// Types
// ============================================================================

export interface UploadFormFields {
  hash?: string; // Frontend-calculated hash for verification
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
  // Technical metadata (from frontend extraction)
  duration?: string;
  bitrate?: string;
  sampleRate?: string;
  channels?: string;
}

export interface AudioMetadata {
  duration?: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
}

export interface CoverImage {
  buffer: Buffer;
  format: string; // MIME type, e.g., 'image/jpeg'
}

export interface StreamingUploadResult {
  hash: string;
  objectName: string;
  size: number;
  mimeType: string;
  metadata: AudioMetadata;
  coverImage: CoverImage | null; // From frontend FormData
  originalFilename: string;
}

export interface ParsedUpload {
  fields: UploadFormFields;
  file: StreamingUploadResult;
  coverFile?: VolatileFile; // Cover file from FormData
}

// ============================================================================
// Main Upload Function
// ============================================================================

/**
 * Parse multipart upload with streaming to MinIO
 *
 * Flow:
 * 1. formidable parses multipart form data
 * 2. For audio file part, create a custom write stream that:
 *    a. Hash calculated by formidable (hashAlgorithm: 'sha256')
 *    b. Streams data directly to MinIO using putObject with stream
 * 3. For cover file part (optional), buffer it in memory
 * 4. Extract metadata from FormData fields (provided by frontend)
 * 5. Return hash, metadata, and cover image
 *
 * No head buffering needed - metadata comes from frontend!
 */
export async function parseStreamingUpload(
  req: IncomingMessage,
  bucketName: string
): Promise<ParsedUpload> {
  const minioClient = getMinioClient();

  // Ensure bucket exists
  const bucketExists = await minioClient.bucketExists(bucketName);
  if (!bucketExists) {
    await minioClient.makeBucket(bucketName);
    logger.info({ bucketName }, 'Created bucket');
  }

  return new Promise((resolve, reject) => {
    // State for file processing
    // IMPORTANT: This implementation assumes single-file upload per request.
    // The frontend sends one file at a time (see frontend/src/components/features/upload/).
    // For multi-file support, these variables would need to be per-file (e.g., using a Map).
    let fileSize = 0;
    let mimeType = '';
    let originalFilename = '';
    let tempObjectName = '';

    const form = formidable({
      maxFileSize: MAX_FILE_SIZE,
      maxFiles: 2, // Audio file + optional cover file
      maxFields: 20,
      allowEmptyFiles: false,
      hashAlgorithm: 'sha256', // formidable calculates hash for us

      // Stream audio file directly to MinIO via PassThrough
      // formidable writes to PassThrough, MinIO reads from it
      // When parse() callback fires, all streams are already closed
      fileWriteStreamHandler: (file?: VolatileFile): PassThrough => {
        const passThrough = new PassThrough();

        // Use mimetype to distinguish audio vs cover (more reliable than order)
        // Note: VolatileFile has mimetype at runtime but @types/formidable is incomplete
        const fileRecord = file ?? {};
        const mime = 'mimetype' in fileRecord ? String(fileRecord.mimetype) : '';
        const isAudioFile = mime.startsWith('audio/') || mime === 'application/octet-stream';

        if (isAudioFile && !tempObjectName) {
          // Audio file - stream to MinIO
          tempObjectName = `temp/${crypto.randomUUID()}`;
          logger.info({ tempObjectName, mimetype: mime }, 'Starting streaming upload');

          // Track size as data flows through
          passThrough.on('data', (chunk: Buffer) => {
            fileSize += chunk.length;
          });

          // MinIO consumes the stream; formidable writes to it
          // No need to await - when parse() callback fires, stream is done
          minioClient
            .putObject(bucketName, tempObjectName, passThrough, undefined, {
              'Content-Type': mime || 'application/octet-stream',
            })
            .then(() => {
              logger.info({ tempObjectName, fileSize }, 'Temp file uploaded to MinIO');
            })
            .catch((error) => {
              logger.error({ error, tempObjectName }, 'Failed to upload to MinIO');
            });
        }
        // Cover file (image/*) or fallback: just buffer it
        return passThrough;
      },
    });

    // Listen to file events to capture metadata
    // Note: maxFiles: 2 in formidable options (audio + optional cover)
    form.on('fileBegin', (formName, file) => {
      if (file && formName === 'file') {
        // Audio file
        mimeType = file.mimetype || 'application/octet-stream';
        originalFilename = file.originalFilename || 'unknown';
        logger.info({ originalFilename, mimeType }, 'Audio file upload started');
      } else if (file && formName === 'cover') {
        // Cover file
        logger.info({ originalFilename: file.originalFilename }, 'Cover file upload started');
      }
    });

    // Parse the request
    form.parse(req, async (err, fields, files) => {
      if (err) {
        logger.error({ error: err }, 'formidable parse error');
        // Clean up temp file on error
        if (tempObjectName) {
          try {
            await minioClient.removeObject(bucketName, tempObjectName);
          } catch (cleanupError) {
            logger.warn({ error: cleanupError, tempObjectName }, 'Failed to clean up temp file');
          }
        }
        reject(new Error(`Upload failed: ${err.message}`));
        return;
      }

      try {
        // Extract form fields (formidable v3 returns arrays)
        const parsedFields = extractFields(fields);

        // Get file info from formidable
        const fileArray = files.file;
        if (!fileArray || fileArray.length === 0) {
          try {
            await minioClient.removeObject(bucketName, tempObjectName);
          } catch (cleanupError) {
            logger.warn({ error: cleanupError, tempObjectName }, 'Failed to clean up temp file');
          }
          reject(new Error('No file provided'));
          return;
        }

        const uploadedFile = fileArray[0];

        // Get hash from formidable (it calculated it via hashAlgorithm option)
        const fileHash = uploadedFile.hash;
        if (!fileHash) {
          await minioClient.removeObject(bucketName, tempObjectName);
          reject(new Error('Failed to calculate file hash'));
          return;
        }

        // Verify hash if frontend provided one
        if (parsedFields.hash && parsedFields.hash !== fileHash) {
          logger.warn(
            { frontendHash: parsedFields.hash, actualHash: fileHash },
            'Hash mismatch'
          );
          await minioClient.removeObject(bucketName, tempObjectName);
          reject(new Error('File integrity check failed'));
          return;
        }

        // Now rename temp file to final name based on hash
        const ext = getFileExtension(originalFilename || 'unknown');
        const objectName = `files/${fileHash}${ext}`;

        // Check if object with this hash already exists (deduplication)
        try {
          await minioClient.statObject(bucketName, objectName);
          // Object exists, delete temp and use existing
          try {
            await minioClient.removeObject(bucketName, tempObjectName);
          } catch (cleanupError) {
            logger.warn({ error: cleanupError, tempObjectName }, 'Failed to clean up temp file');
          }
          logger.info({ objectName }, 'File already exists in MinIO, reusing');
        } catch {
          // Object doesn't exist, attempt to rename temp to final
          try {
            await minioClient.copyObject(
              bucketName,
              objectName,
              `/${bucketName}/${tempObjectName}`
            );
            await minioClient.removeObject(bucketName, tempObjectName);
            logger.info({ objectName, fileSize }, 'File uploaded to MinIO');
          } catch (copyErr) {
            // Possible race: object was created by another concurrent upload
            try {
              await minioClient.statObject(bucketName, objectName);
              // Object now exists, treat as deduplication
              try {
                await minioClient.removeObject(bucketName, tempObjectName);
              } catch (cleanupError) {
                logger.warn({ error: cleanupError, tempObjectName }, 'Failed to clean up temp file');
              }
              logger.info({ objectName }, 'File already exists after race, reusing');
            } catch {
              // If still doesn't exist, propagate error
              try {
                await minioClient.removeObject(bucketName, tempObjectName);
              } catch (cleanupError) {
                logger.warn({ error: cleanupError, tempObjectName }, 'Failed to clean up temp file');
              }
              logger.error({ objectName, copyErr }, 'Failed to upload file to MinIO');
              reject(new Error('Failed to upload file to MinIO'));
              return;
            }
          }
        }

        // Extract metadata from FormData fields (provided by frontend)
        let metadata: AudioMetadata = {};
        let coverImage: CoverImage | null = null;

        // Get metadata from FormData
        if (parsedFields.duration) {
          metadata.duration = parseInt(parsedFields.duration, 10);
        }
        if (parsedFields.bitrate) {
          metadata.bitrate = parseInt(parsedFields.bitrate, 10);
        }
        if (parsedFields.sampleRate) {
          metadata.sampleRate = parseInt(parsedFields.sampleRate, 10);
        }
        if (parsedFields.channels) {
          metadata.channels = parseInt(parsedFields.channels, 10);
        }

        logger.info(metadata, 'Metadata from frontend FormData');

        // Get cover image from FormData if provided
        const coverArray = files.cover;
        if (coverArray && coverArray.length > 0) {
          const coverFile = coverArray[0];
          try {
            const fs = await import('fs/promises');
            const coverBuffer = await fs.readFile(coverFile.filepath);
            coverImage = {
              buffer: coverBuffer,
              format: coverFile.mimetype || 'image/jpeg',
            };
            logger.info(
              { format: coverImage.format, size: coverImage.buffer.length },
              'Cover art from frontend FormData'
            );
          } catch (error) {
            logger.warn({ error }, 'Failed to read cover file');
          }
        }

        resolve({
          fields: parsedFields,
          file: {
            hash: fileHash,
            objectName,
            size: fileSize || uploadedFile.size,
            mimeType: mimeType || uploadedFile.mimetype || 'application/octet-stream',
            metadata,
            coverImage,
            originalFilename,
          },
        });
      } catch (error) {
        logger.error({ error }, 'Error processing upload');
        // Clean up temp file on error
        if (tempObjectName) {
          try {
            await minioClient.removeObject(bucketName, tempObjectName);
          } catch (cleanupError) {
            logger.warn({ error: cleanupError, tempObjectName }, 'Failed to clean up temp file');
          }
        }
        reject(error);
      }
    });
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract first value from formidable field arrays
 */
function extractFields(fields: formidable.Fields): UploadFormFields {
  const getValue = (key: string): string | undefined => {
    const value = fields[key];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value as string | undefined;
  };

  return {
    hash: getValue('hash'),
    title: getValue('title'),
    artist: getValue('artist'),
    album: getValue('album'),
    albumArtist: getValue('albumArtist'),
    genre: getValue('genre'),
    composer: getValue('composer'),
    coverUrl: getValue('coverUrl'),
    year: getValue('year'),
    trackNumber: getValue('trackNumber'),
    discNumber: getValue('discNumber'),
    // Technical metadata from frontend
    duration: getValue('duration'),
    bitrate: getValue('bitrate'),
    sampleRate: getValue('sampleRate'),
    channels: getValue('channels'),
  };
}

/**
 * Extract file extension from filename
 */
function getFileExtension(filename: string): string {
  const match = filename.match(/\.[^.]+$/);
  return match ? match[0].toLowerCase() : '';
}

/**
 * Upload cover image to MinIO
 */
export async function uploadCoverImage(
  coverImage: CoverImage,
  fileHash: string,
  bucketName: string
): Promise<string> {
  const minioClient = getMinioClient();

  const coverExt = getExtensionFromMimeType(coverImage.format);
  const coverObjectName = `covers/${fileHash}.${coverExt}`;

  await minioClient.putObject(
    bucketName,
    coverObjectName,
    coverImage.buffer,
    coverImage.buffer.length,
    { 'Content-Type': coverImage.format }
  );

  logger.info({ coverObjectName }, 'Cover image uploaded to MinIO');

  return coverObjectName;
}

/**
 * Extract file extension from MIME type
 * e.g., 'image/jpeg' -> 'jpg', 'image/png' -> 'png'
 */
function getExtensionFromMimeType(mimeType: string): string {
  // Extract subtype from MIME type (e.g., 'jpeg' from 'image/jpeg')
  const subtype = mimeType.split('/')[1];
  if (!subtype) {
    return 'bin';
  }

  // Handle common special cases
  if (subtype === 'jpeg') {
    return 'jpg';
  }

  // Remove any parameters (e.g., 'png; charset=utf-8' -> 'png')
  const ext = subtype.split(';')[0].trim();

  return ext || 'bin';
}
