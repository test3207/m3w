import { logger } from '../logger-client';

/**
 * Calculate SHA256 hash of a File (browser version using Web Crypto API)
 */
export async function calculateFileHash(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    logger.info('Calculated file hash', { 
      fileName: file.name, 
      fileSize: file.size, 
      hash: hashHex 
    });
    
    return hashHex;
  } catch (error) {
    logger.error('Error calculating file hash', error);
    throw error;
  }
}

/**
 * Calculate SHA256 hash of an ArrayBuffer (browser version)
 */
export async function calculateBufferHash(buffer: ArrayBuffer): Promise<string> {
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    logger.info('Calculated buffer hash', { 
      size: buffer.byteLength, 
      hash: hashHex 
    });
    
    return hashHex;
  } catch (error) {
    logger.error('Error calculating buffer hash', error);
    throw error;
  }
}
