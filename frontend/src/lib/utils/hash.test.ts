import { describe, it, expect } from "vitest";
import { calculateBufferHash } from "./hash";

// Helper to create ArrayBuffer from string (browser-compatible)
function stringToBuffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer;
}

describe("Hash Utils", () => {
  describe("calculateBufferHash", () => {
    it("should generate consistent SHA256 hash for same content", async () => {
      const content = stringToBuffer("test content");
      const hash1 = await calculateBufferHash(content);
      const hash2 = await calculateBufferHash(content);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 produces 64 hex characters
    });

    it("should generate different hashes for different content", async () => {
      const content1 = stringToBuffer("test content 1");
      const content2 = stringToBuffer("test content 2");

      const hash1 = await calculateBufferHash(content1);
      const hash2 = await calculateBufferHash(content2);

      expect(hash1).not.toBe(hash2);
    });

    it("should generate correct SHA256 hash", async () => {
      // Known SHA256 hash for "hello world"
      const content = stringToBuffer("hello world");
      const expectedHash = "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";

      const hash = await calculateBufferHash(content);

      expect(hash).toBe(expectedHash);
    });

    it("should handle empty buffer", async () => {
      const content = stringToBuffer("");
      const hash = await calculateBufferHash(content);

      // SHA256 of empty string
      expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    });

    it("should handle binary data", async () => {
      const content = new Uint8Array([0x00, 0x01, 0x02, 0xFF, 0xFE]).buffer;
      const hash = await calculateBufferHash(content);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // Valid hex string
    });

    it("should be case-insensitive for same content", async () => {
      const content1 = stringToBuffer("Test Content");
      const content2 = stringToBuffer("Test Content");

      const hash1 = await calculateBufferHash(content1);
      const hash2 = await calculateBufferHash(content2);

      expect(hash1).toBe(hash2);
    });
  });
});
