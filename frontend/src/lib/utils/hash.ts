import { Sha256 } from "@aws-crypto/sha256-browser";
import { logger } from "../logger-client";

/**
 * Convert hash digest to hex string
 */
function digestToHex(digest: Uint8Array): string {
  return Array.from(digest)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Calculate SHA256 hash from a ReadableStream (memory-efficient)
 *
 * Processes data in chunks as provided by the browser's ReadableStream
 * implementation, instead of loading the entire file into memory.
 * This library automatically:
 * - Uses native crypto.subtle when available (HTTPS/localhost) - fast
 * - Falls back to pure JS implementation otherwise (HTTP LAN) - slower but works
 *
 * @param stream - ReadableStream to hash
 * @returns SHA256 hash as hex string
 */
export async function calculateHashFromStream(
  stream: ReadableStream<Uint8Array>
): Promise<string> {
  const hash = new Sha256();
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
    }

    const digest = await hash.digest();
    return digestToHex(digest);
  } finally {
    reader.releaseLock();
  }
}

/**
 * Calculate SHA256 hash of a File using streaming (memory-efficient)
 * Works in both secure (HTTPS) and non-secure (HTTP LAN) contexts
 *
 * @param file - File to hash
 * @returns SHA256 hash as hex string
 */
export async function calculateFileHash(file: File): Promise<string> {
  try {
    const hashHex = await calculateHashFromStream(file.stream());

    logger.info("[Hash][calculateFileHash]", "Calculated file hash (streaming)", {
      raw: { fileName: file.name, fileSize: file.size, hash: hashHex },
    });

    return hashHex;
  } catch (error) {
    logger.error("[Hash][calculateFileHash]", "Error calculating file hash", error);
    throw error;
  }
}

/**
 * Calculate SHA256 hash of an ArrayBuffer
 * Works in both secure (HTTPS) and non-secure (HTTP LAN) contexts
 */
export async function calculateBufferHash(buffer: ArrayBuffer): Promise<string> {
  try {
    const hash = new Sha256();
    hash.update(new Uint8Array(buffer));
    const digest = await hash.digest();
    const hashHex = digestToHex(digest);

    logger.info("[Hash][calculateBufferHash]", "Calculated buffer hash", {
      raw: { size: buffer.byteLength, hash: hashHex },
    });

    return hashHex;
  } catch (error) {
    logger.error("[Hash][calculateBufferHash]", "Error calculating buffer hash", error);
    throw error;
  }
}
