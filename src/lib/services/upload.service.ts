import { prisma } from '../db/prisma';
import { createStorageAdapter } from '../storage/azure-blob.adapter';
import { calculateBufferHash } from '../utils/hash';
import {
  extractMetadataFromBuffer,
  extractPhysicalProperties,
  extractUserMetadata,
  generateFallbackMetadata,
} from '../metadata/extractor';
import { logger } from '../logger';

// Lazy initialize storage adapter on first use
let storageAdapter: ReturnType<typeof createStorageAdapter> | null = null;

function getStorageAdapter() {
  if (!storageAdapter) {
    storageAdapter = createStorageAdapter();
  }
  return storageAdapter;
}

interface UploadResult {
  fileId: string;
  hash: string;
  isNewFile: boolean;
  metadata: {
    duration: number | null;
    bitrate: number | null;
    sampleRate: number | null;
    channels: number | null;
  };
  suggestedMetadata: {
    title: string | null;
    artist: string | null;
    album: string | null;
    albumArtist: string | null;
    year: number | null;
    genre: string | null;
    trackNumber: number | null;
    discNumber: number | null;
    composer: string | null;
  };
}

/**
 * Upload audio file with deduplication
 * @param buffer - File buffer
 * @param filename - Original filename
 * @param mimeType - MIME type
 * @returns Upload result with file ID and metadata
 */
export async function uploadAudioFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<UploadResult> {
  try {
    // Step 1: Calculate file hash
    const hash = calculateBufferHash(buffer);
    logger.info({ msg: 'File hash calculated', hash, filename });

    // Step 2: Check if file already exists
    let file = await prisma.file.findUnique({
      where: { hash },
    });

    let isNewFile = false;

    if (file) {
      // File exists, increment reference count
      file = await prisma.file.update({
        where: { id: file.id },
        data: { refCount: { increment: 1 } },
      });

      logger.info({
        msg: 'File already exists, reusing',
        fileId: file.id,
        hash,
        refCount: file.refCount,
      });
    } else {
      // Step 3: Extract metadata from buffer
      const metadata = await extractMetadataFromBuffer(buffer, mimeType);
      const physicalProps = extractPhysicalProperties(metadata);

      // Step 4: Upload to storage (Azure Blob Storage in production, MinIO in dev)
      const extension = getExtensionFromMimeType(mimeType);
      const objectName = `files/${hash}${extension}`;
      await getStorageAdapter().uploadFile(buffer, objectName, mimeType);

      // Step 5: Create File record
      file = await prisma.file.create({
        data: {
          hash,
          path: objectName,
          size: buffer.length,
          mimeType,
          duration: physicalProps.duration,
          bitrate: physicalProps.bitrate,
          sampleRate: physicalProps.sampleRate,
          channels: physicalProps.channels,
          refCount: 1,
        },
      });

      isNewFile = true;

      logger.info({
        msg: 'New file uploaded',
        fileId: file.id,
        hash,
        size: buffer.length,
      });
    }

    // Step 6: Extract suggested metadata for user
    let suggestedMetadata;
    
    try {
      const metadata = await extractMetadataFromBuffer(buffer, mimeType);
      suggestedMetadata = extractUserMetadata(metadata);
      
      // If no title found in metadata, use fallback
      if (!suggestedMetadata.title) {
        const fallback = generateFallbackMetadata(filename);
        suggestedMetadata = {
          ...suggestedMetadata,
          title: fallback.title,
          artist: suggestedMetadata.artist || fallback.artist,
        };
      }
      
      logger.info({
        msg: 'Metadata extracted successfully',
        hasTitle: !!suggestedMetadata.title,
        hasArtist: !!suggestedMetadata.artist,
      });
    } catch (metadataError) {
      // If metadata extraction fails, use filename-based fallback
      logger.warn({
        msg: 'Failed to extract metadata, using fallback',
        filename,
        error: metadataError,
      });
      
      suggestedMetadata = generateFallbackMetadata(filename);
    }

    return {
      fileId: file.id,
      hash: file.hash,
      isNewFile,
      metadata: {
        duration: file.duration,
        bitrate: file.bitrate,
        sampleRate: file.sampleRate,
        channels: file.channels,
      },
      suggestedMetadata,
    };
  } catch (error) {
    logger.error({ msg: 'Error uploading audio file', filename, error });
    throw error;
  }
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/flac': '.flac',
    'audio/wav': '.wav',
    'audio/wave': '.wav',
    'audio/x-wav': '.wav',
    'audio/ogg': '.ogg',
    'audio/m4a': '.m4a',
    'audio/mp4': '.m4a',
    'audio/x-m4a': '.m4a',
    'audio/aac': '.aac',
  };
  
  return mimeToExt[mimeType] || '.audio';
}

/**
 * Decrement file reference count and cleanup if needed
 * @param fileId - File ID
 */
export async function decrementFileRef(fileId: string): Promise<void> {
  try {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      logger.warn({ msg: 'File not found for decrement', fileId });
      return;
    }

    const newRefCount = file.refCount - 1;

    if (newRefCount <= 0) {
      try {
        await getStorageAdapter().deleteFile(file.path);

        logger.info({
          msg: 'File deleted from object storage',
          fileId,
          hash: file.hash,
          objectPath: file.path,
        });
      } catch (deleteError) {
        if (isObjectNotFoundError(deleteError)) {
          logger.warn({
            msg: 'File missing in object storage during deletion',
            fileId,
            hash: file.hash,
            objectPath: file.path,
          });
        } else {
          logger.error({
            msg: 'Failed to delete file from object storage',
            fileId,
            hash: file.hash,
            objectPath: file.path,
            error: deleteError,
          });

          throw deleteError;
        }
      }

      await prisma.file.delete({
        where: { id: fileId },
      });

      logger.info({
        msg: 'File metadata deleted',
        fileId,
        hash: file.hash,
      });
    } else {
      await prisma.file.update({
        where: { id: fileId },
        data: { refCount: newRefCount },
      });

      logger.info({
        msg: 'File reference decremented',
        fileId,
        refCount: newRefCount,
      });
    }
  } catch (error) {
    logger.error({ msg: 'Error decrementing file reference', fileId, error });
    throw error;
  }
}

function isObjectNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: string; statusCode?: number };

  return (
    candidate.code === 'NoSuchKey' ||
    candidate.code === 'NotFound' ||
    candidate.statusCode === 404
  );
}
