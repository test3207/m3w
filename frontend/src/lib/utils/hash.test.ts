import { describe, it, expect } from "vitest";
import { calculateBufferHash, calculateHashFromStream, calculateFileHash } from "./hash";

// Helper to create ArrayBuffer from string (browser-compatible)
function stringToBuffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer;
}

// Helper to create a ReadableStream from string
function stringToStream(str: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

// Helper to create a mock File
function createMockFile(content: string, name: string = "test.txt"): File {
  const blob = new Blob([content], { type: "text/plain" });
  return new File([blob], name, { type: "text/plain" });
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

  describe("calculateHashFromStream", () => {
    it("should generate SHA256 hash from stream", async () => {
      const stream = stringToStream("hello world");
      const hash = await calculateHashFromStream(stream);

      // Same as buffer hash for same content
      expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
    });

    it("should generate consistent hash for same stream content", async () => {
      const stream1 = stringToStream("test content for streaming");
      const stream2 = stringToStream("test content for streaming");

      const hash1 = await calculateHashFromStream(stream1);
      const hash2 = await calculateHashFromStream(stream2);

      expect(hash1).toBe(hash2);
    });

    it("should generate different hashes for different stream content", async () => {
      const stream1 = stringToStream("content A");
      const stream2 = stringToStream("content B");

      const hash1 = await calculateHashFromStream(stream1);
      const hash2 = await calculateHashFromStream(stream2);

      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty stream", async () => {
      const stream = stringToStream("");
      const hash = await calculateHashFromStream(stream);

      // SHA256 of empty content
      expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    });

    it("should handle multi-chunk stream", async () => {
      // Create a stream that emits multiple chunks
      const chunks = ["chunk1", "chunk2", "chunk3"];
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          chunks.forEach((chunk) => {
            controller.enqueue(encoder.encode(chunk));
          });
          controller.close();
        },
      });

      const hash = await calculateHashFromStream(stream);

      // Should match hash of concatenated content
      const bufferHash = await calculateBufferHash(stringToBuffer("chunk1chunk2chunk3"));
      expect(hash).toBe(bufferHash);
    });

    it("should return valid hex string", async () => {
      const stream = stringToStream("any content");
      const hash = await calculateHashFromStream(stream);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("calculateFileHash", () => {
    it("should generate SHA256 hash from file", async () => {
      const file = createMockFile("hello world");
      const hash = await calculateFileHash(file);

      expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
    });

    it("should generate consistent hash for same file content", async () => {
      const file1 = createMockFile("test file content");
      const file2 = createMockFile("test file content");

      const hash1 = await calculateFileHash(file1);
      const hash2 = await calculateFileHash(file2);

      expect(hash1).toBe(hash2);
    });

    it("should generate different hashes for different file content", async () => {
      const file1 = createMockFile("file content A");
      const file2 = createMockFile("file content B");

      const hash1 = await calculateFileHash(file1);
      const hash2 = await calculateFileHash(file2);

      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty file", async () => {
      const file = createMockFile("");
      const hash = await calculateFileHash(file);

      // SHA256 of empty content
      expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    });

    it("should return same hash as buffer for same content", async () => {
      const content = "identical content for comparison";
      const file = createMockFile(content);
      const buffer = stringToBuffer(content);

      const fileHash = await calculateFileHash(file);
      const bufferHash = await calculateBufferHash(buffer);

      expect(fileHash).toBe(bufferHash);
    });

    it("should return valid hex string", async () => {
      const file = createMockFile("any file content");
      const hash = await calculateFileHash(file);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle file with different name but same content", async () => {
      const file1 = createMockFile("same content", "file1.txt");
      const file2 = createMockFile("same content", "file2.txt");

      const hash1 = await calculateFileHash(file1);
      const hash2 = await calculateFileHash(file2);

      // File name should not affect hash - only content matters
      expect(hash1).toBe(hash2);
    });

    it("should handle binary file content", async () => {
      const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0xFF, 0xFE]);
      const blob = new Blob([binaryData], { type: "application/octet-stream" });
      const file = new File([blob], "binary.bin", { type: "application/octet-stream" });

      const hash = await calculateFileHash(file);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
