/**
 * UUID generation with fallback for non-secure contexts (HTTP LAN mode)
 *
 * crypto.randomUUID() requires secure context (HTTPS or localhost).
 * This module provides a fallback using crypto.getRandomValues() which
 * works in non-secure contexts in most browsers.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID
 */

/**
 * Check if crypto.randomUUID is available
 * It requires secure context (HTTPS or localhost)
 */
function isRandomUUIDAvailable(): boolean {
  return (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  );
}

/**
 * Generate a v4 UUID using crypto.getRandomValues()
 * Works in non-secure contexts where crypto.randomUUID() is unavailable
 *
 * @see https://stackoverflow.com/a/2117523/2800218
 */
function generateUUIDFallback(): string {
  // Use crypto.getRandomValues which works in non-secure contexts
  const getRandomValues =
    typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"
      ? (arr: Uint8Array) => crypto.getRandomValues(arr)
      : // Final fallback to Math.random (not cryptographically secure, but works)
      (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      };

  // Generate 16 random bytes
  const rnds = new Uint8Array(16);
  getRandomValues(rnds);

  // Set version (4) and variant (RFC4122)
  rnds[6] = (rnds[6] & 0x0f) | 0x40; // Version 4
  rnds[8] = (rnds[8] & 0x3f) | 0x80; // Variant RFC4122

  // Convert to hex string with dashes
  const hex = Array.from(rnds)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Generate a v4 UUID
 *
 * - Uses native crypto.randomUUID() when available (secure contexts)
 * - Falls back to crypto.getRandomValues() based implementation (non-secure contexts)
 * - Final fallback to Math.random() if crypto is completely unavailable
 */
export function generateUUID(): string {
  if (isRandomUUIDAvailable()) {
    return crypto.randomUUID();
  }
  return generateUUIDFallback();
}
