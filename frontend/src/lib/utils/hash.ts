import { Sha256 } from "@aws-crypto/sha256-browser";
import { logger } from "../logger-client";

/**
 * Calculate SHA256 hash using @aws-crypto/sha256-browser
 *
 * This library automatically:
 * - Uses native crypto.subtle when available (HTTPS/localhost) - fast
 * - Falls back to pure JS implementation otherwise (HTTP LAN) - slower but works
 *
 * @see https://github.com/aws/aws-sdk-js-crypto-helpers
 */
async function sha256(data: Uint8Array): Promise<string> {
  const hash = new Sha256();
  hash.update(data);
  const digest = await hash.digest();
  return Array.from(digest)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Calculate SHA256 hash of a File
 * Works in both secure (HTTPS) and non-secure (HTTP LAN) contexts
 */
export async function calculateFileHash(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const hashHex = await sha256(new Uint8Array(buffer));

    logger.info("Calculated file hash", {
      fileName: file.name,
      fileSize: file.size,
      hash: hashHex,
    });

    return hashHex;
  } catch (error) {
    logger.error("Error calculating file hash", error);
    throw error;
  }
}

/**
 * Calculate SHA256 hash of an ArrayBuffer
 * Works in both secure (HTTPS) and non-secure (HTTP LAN) contexts
 */
export async function calculateBufferHash(buffer: ArrayBuffer): Promise<string> {
  try {
    const hashHex = await sha256(new Uint8Array(buffer));

    logger.info("Calculated buffer hash", {
      size: buffer.byteLength,
      hash: hashHex,
    });

    return hashHex;
  } catch (error) {
    logger.error("Error calculating buffer hash", error);
    throw error;
  }
}
