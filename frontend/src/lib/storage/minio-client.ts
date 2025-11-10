import * as Minio from 'minio';
import { Readable } from 'stream';
import { logger } from '../logger';

// MinIO client singleton
let minioClient: Minio.Client | null = null;

/**
 * Get or create MinIO client instance
 */
export function getMinioClient(): Minio.Client {
  if (!minioClient) {
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = parseInt(process.env.MINIO_PORT || '9000', 10);
    const useSSL = process.env.MINIO_USE_SSL === 'true';
    const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
    const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';

    minioClient = new Minio.Client({
      endPoint: endpoint,
      port: port,
      useSSL: useSSL,
      accessKey: accessKey,
      secretKey: secretKey,
    });

    logger.info({
      msg: 'MinIO client initialized',
      endpoint,
      port,
      useSSL,
    });
  }

  return minioClient;
}

/**
 * Ensure bucket exists, create if not
 */
export async function ensureBucket(bucketName: string): Promise<void> {
  const client = getMinioClient();

  try {
    const exists = await client.bucketExists(bucketName);
    if (!exists) {
      await client.makeBucket(bucketName, 'us-east-1');
      logger.info({ msg: `Bucket created: ${bucketName}` });
    }
  } catch (error) {
    logger.error({ msg: 'Error ensuring bucket exists', bucketName, error });
    throw error;
  }
}

/**
 * Upload file to MinIO
 * @param bucketName - Bucket name
 * @param objectName - Object name (file path in bucket)
 * @param stream - Readable stream or Buffer
 * @param size - File size in bytes
 * @param metadata - Optional metadata
 * @returns Upload result with etag
 */
export async function uploadFile(
  bucketName: string,
  objectName: string,
  stream: Buffer | Readable,
  size: number,
  metadata?: Record<string, string>
) {
  const client = getMinioClient();

  try {
    await ensureBucket(bucketName);

    const result = await client.putObject(
      bucketName,
      objectName,
      stream,
      size,
      metadata
    );

    logger.info({
      msg: 'File uploaded successfully',
      bucketName,
      objectName,
      size,
      etag: result.etag,
    });

    return result;
  } catch (error) {
    logger.error({ msg: 'Error uploading file', bucketName, objectName, error });
    throw error;
  }
}

/**
 * Get presigned URL for file download
 * @param bucketName - Bucket name
 * @param objectName - Object name
 * @param expirySeconds - URL expiry time in seconds (default: 24 hours)
 * @returns Presigned URL
 */
export async function getPresignedUrl(
  bucketName: string,
  objectName: string,
  expirySeconds: number = 86400 // 24 hours
): Promise<string> {
  const client = getMinioClient();

  try {
    const url = await client.presignedGetObject(
      bucketName,
      objectName,
      expirySeconds
    );

    logger.debug({
      msg: 'Generated presigned URL',
      bucketName,
      objectName,
      expirySeconds,
    });

    return url;
  } catch (error) {
    logger.error({
      msg: 'Error generating presigned URL',
      bucketName,
      objectName,
      error,
    });
    throw error;
  }
}

/**
 * Delete file from MinIO
 * @param bucketName - Bucket name
 * @param objectName - Object name
 */
export async function deleteFile(
  bucketName: string,
  objectName: string
): Promise<void> {
  const client = getMinioClient();

  try {
    await client.removeObject(bucketName, objectName);

    logger.info({ msg: 'File deleted successfully', bucketName, objectName });
  } catch (error) {
    logger.error({ msg: 'Error deleting file', bucketName, objectName, error });
    throw error;
  }
}

/**
 * List objects in bucket with prefix
 * @param bucketName - Bucket name
 * @param prefix - Object prefix filter
 * @param recursive - List recursively
 * @returns Array of objects
 */
export async function listObjects(
  bucketName: string,
  prefix: string = '',
  recursive: boolean = true
) {
  const client = getMinioClient();

  try {
    const objects: Minio.BucketItem[] = [];
    const stream = client.listObjects(bucketName, prefix, recursive);

    return new Promise<Minio.BucketItem[]>((resolve, reject) => {
      stream.on('data', (obj) => {
        if (obj.name) {
          objects.push(obj as Minio.BucketItem);
        }
      });
      stream.on('error', reject);
      stream.on('end', () => {
        logger.debug({
          msg: 'Listed objects',
          bucketName,
          prefix,
          count: objects.length,
        });
        resolve(objects);
      });
    });
  } catch (error) {
    logger.error({ msg: 'Error listing objects', bucketName, prefix, error });
    throw error;
  }
}

/**
 * Get file stats (metadata)
 * @param bucketName - Bucket name
 * @param objectName - Object name
 * @returns File stats
 */
export async function getFileStat(
  bucketName: string,
  objectName: string
): Promise<Minio.BucketItemStat> {
  const client = getMinioClient();

  try {
    const stat = await client.statObject(bucketName, objectName);

    logger.debug({
      msg: 'Retrieved file stats',
      bucketName,
      objectName,
      size: stat.size,
    });

    return stat;
  } catch (error) {
    logger.error({ msg: 'Error getting file stats', bucketName, objectName, error });
    throw error;
  }
}
