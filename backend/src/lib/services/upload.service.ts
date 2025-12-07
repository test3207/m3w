/**
 * Streaming Upload Service
 *
 * Implements streaming file upload with:
 * - Head buffering for metadata extraction (first 1MB)
 * - Direct streaming to MinIO (remaining data)
 * - SHA256 hash calculation during streaming
 * - Cover art extraction from audio files
 *
 * @see https://github.com/test3207/m3w/issues/120
 */

import { PassThrough, Writable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import crypto from 'node:crypto';
import formidable from 'formidable';
import type VolatileFile from 'formidable/VolatileFile';
import { parseBuffer } from 'music-metadata';
import { getMinioClient } from '../minio-client';
import { logger } from '../logger';

// ============================================================================
// Constants
// ============================================================================

/** Size of head buffer for metadata extraction (1MB) */
const HEAD_BUFFER_SIZE = 1024 * 1024;

/** Maximum file size (500MB) */
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// ============================================================================
// Types
// ============================================================================

export interface UploadFormFields {
  libraryId: string;
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
  coverImage: CoverImage | null;
  originalFilename: string;
}

export interface ParsedUpload {
  fields: UploadFormFields;
  file: StreamingUploadResult;
}

// ============================================================================
// Main Upload Function
// ============================================================================

/**
 * Parse multipart upload with streaming to MinIO
 *
 * Flow:
 * 1. formidable parses multipart form data
 * 2. For file parts, create a custom write stream that:
 *    a. Buffers first 1MB for metadata extraction
 *    b. Calculates SHA256 hash incrementally
 *    c. Streams data to MinIO using putObject with stream
 * 3. After upload, extract metadata from head buffer
 * 4. Return hash, metadata, and cover image
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
    let headBuffer: Buffer | null = null;
    let tempObjectName = '';
    let uploadError: Error | null = null;

    // Store upload promise to wait for MinIO putObject completion
    let uploadPromise: Promise<void> | null = null;

    const form = formidable({
      maxFileSize: MAX_FILE_SIZE,
      maxFields: 20,
      allowEmptyFiles: false,
      hashAlgorithm: 'sha256', // formidable calculates hash for us

      // Custom file write stream handler - the key to streaming upload
      fileWriteStreamHandler: (_file?: VolatileFile): Writable => {
        // Generate temporary object name (will rename after hash is known from formidable)
        const tempId = crypto.randomUUID();
        tempObjectName = `temp/${tempId}`;

        logger.info({ tempObjectName }, 'Starting streaming upload');

        const passThrough = new PassThrough();

        // Head buffering state (for metadata extraction)
        const headChunks: Buffer[] = [];
        let headBytesBuffered = 0;
        let uploadedSize = 0;

        // Create a writable stream that handles everything
        const writeStream = new Writable({
          write(chunk: Buffer, _encoding, callback) {
            uploadedSize += chunk.length;

            // Buffer head portion (first 1MB for metadata extraction)
            if (headBytesBuffered < HEAD_BUFFER_SIZE) {
              const remaining = HEAD_BUFFER_SIZE - headBytesBuffered;
              const headPortion = chunk.subarray(0, Math.min(chunk.length, remaining));
              headChunks.push(headPortion);
              headBytesBuffered += headPortion.length;
            }

            // Write to passThrough for MinIO with proper backpressure handling
            const canContinue = passThrough.write(chunk);
            if (canContinue) {
              callback();
            } else {
              // Wait for drain event before accepting more data
              passThrough.once('drain', callback);
            }
          },

          final(callback) {
            fileSize = uploadedSize;
            headBuffer = Buffer.concat(headChunks);

            logger.info({ fileSize, headBufferSize: headBuffer.length }, 'File streaming complete');

            // End the passThrough stream
            passThrough.end(callback);
          },

          destroy(err, callback) {
            passThrough.destroy(err || undefined);
            callback(err);
          },
        });

        // Start MinIO upload with the passThrough stream (just upload to temp, rename later)
        uploadPromise = (async () => {
          try {
            await minioClient.putObject(
              bucketName,
              tempObjectName,
              passThrough,
              undefined, // size unknown for streaming
              { 'Content-Type': 'application/octet-stream' }
            );
            logger.info({ tempObjectName }, 'Temp file uploaded to MinIO');
          } catch (error) {
            uploadError = error instanceof Error ? error : new Error(String(error));
            logger.error({ error, tempObjectName }, 'Failed to upload to MinIO');
            throw error;
          }
        })();

        return writeStream;
      },
    });

    // Listen to file events to capture metadata
    form.on('fileBegin', (_formName, file) => {
      if (file) {
        mimeType = file.mimetype || 'application/octet-stream';
        originalFilename = file.originalFilename || 'unknown';
        logger.info({ originalFilename, mimeType }, 'File upload started');
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
          } catch {
            // Ignore cleanup errors
          }
        }
        reject(new Error(`Upload failed: ${err.message}`));
        return;
      }

      try {
        // Wait for MinIO upload to complete
        if (uploadPromise) {
          await uploadPromise;
        }

        // Check for upload errors
        if (uploadError) {
          // Clean up temp file on upload error
          if (tempObjectName) {
            try {
              await minioClient.removeObject(bucketName, tempObjectName);
              logger.info({ tempObjectName }, 'Cleaned up temp file after upload error');
            } catch {
              // Ignore cleanup errors
            }
          }
          reject(uploadError);
          return;
        }

        // Extract form fields (formidable v3 returns arrays)
        const parsedFields = extractFields(fields);

        // Validate required fields
        if (!parsedFields.libraryId) {
          await minioClient.removeObject(bucketName, tempObjectName);
          reject(new Error('Library ID is required'));
          return;
        }

        // Get file info from formidable
        const fileArray = files.file;
        if (!fileArray || fileArray.length === 0) {
          await minioClient.removeObject(bucketName, tempObjectName);
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
          await minioClient.removeObject(bucketName, tempObjectName);
          logger.info({ objectName }, 'File already exists in MinIO, reusing');
        } catch {
          // Object doesn't exist, rename temp to final
          await minioClient.copyObject(
            bucketName,
            objectName,
            `/${bucketName}/${tempObjectName}`
          );
          await minioClient.removeObject(bucketName, tempObjectName);
          logger.info({ objectName, fileSize }, 'File uploaded to MinIO');
        }

        // Extract metadata from head buffer
        let metadata: AudioMetadata = {};
        let coverImage: CoverImage | null = null;

        if (headBuffer && headBuffer.length > 0) {
          try {
            const parsed = await parseBuffer(headBuffer, {
              mimeType: mimeType,
              size: fileSize,
            });

            metadata = {
              duration: parsed.format.duration
                ? Math.floor(parsed.format.duration)
                : undefined,
              bitrate: parsed.format.bitrate
                ? Math.floor(parsed.format.bitrate / 1000)
                : undefined,
              sampleRate: parsed.format.sampleRate,
              channels: parsed.format.numberOfChannels,
            };

            // Extract cover art
            if (parsed.common.picture && parsed.common.picture.length > 0) {
              const picture = parsed.common.picture[0];
              coverImage = {
                buffer: Buffer.from(picture.data),
                format: picture.format,
              };
              logger.info(
                { format: coverImage.format, size: coverImage.buffer.length },
                'Cover art extracted from head buffer'
              );
            }

            logger.info(metadata, 'Metadata extracted from head buffer');
          } catch (error) {
            logger.warn({ error }, 'Failed to extract metadata from head buffer');
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
          } catch {
            // Ignore cleanup errors
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
    libraryId: getValue('libraryId') || '',
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
