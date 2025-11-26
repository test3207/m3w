import * as Minio from 'minio';
import { logger } from './logger';

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

    logger.info(
      {
        endpoint,
        port,
        useSSL,
      },
      'MinIO client initialized'
    );
  }

  return minioClient;
}
