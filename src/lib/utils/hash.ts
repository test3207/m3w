import crypto from 'crypto';
import { createReadStream } from 'fs';
import { logger } from '../logger';

/**
 * Calculate SHA256 hash of a file
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => {
      const fileHash = hash.digest('hex');
      logger.debug({ msg: 'Calculated file hash', filePath, hash: fileHash });
      resolve(fileHash);
    });
    stream.on('error', (error) => {
      logger.error({ msg: 'Error calculating file hash', filePath, error });
      reject(error);
    });
  });
}

/**
 * Calculate SHA256 hash of a buffer
 */
export function calculateBufferHash(buffer: Buffer): string {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  logger.debug({ msg: 'Calculated buffer hash', size: buffer.length, hash });
  return hash;
}
