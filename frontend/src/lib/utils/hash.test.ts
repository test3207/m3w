import { describe, it, expect } from 'vitest';
import { calculateBufferHash } from './hash';

describe('Hash Utils', () => {
  describe('calculateBufferHash', () => {
    it('should generate consistent SHA256 hash for same content', async () => {
      const content = new Uint8Array(Buffer.from('test content')).buffer;
      const hash1 = await calculateBufferHash(content);
      const hash2 = await calculateBufferHash(content);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 produces 64 hex characters
    });

    it('should generate different hashes for different content', async () => {
      const content1 = new Uint8Array(Buffer.from('test content 1')).buffer;
      const content2 = new Uint8Array(Buffer.from('test content 2')).buffer;

      const hash1 = await calculateBufferHash(content1);
      const hash2 = await calculateBufferHash(content2);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate correct SHA256 hash', async () => {
      // Known SHA256 hash for "hello world"
      const content = new Uint8Array(Buffer.from('hello world')).buffer;
      const expectedHash = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';

      const hash = await calculateBufferHash(content);

      expect(hash).toBe(expectedHash);
    });

    it('should handle empty buffer', async () => {
      const content = new Uint8Array(Buffer.from('')).buffer;
      const hash = await calculateBufferHash(content);

      // SHA256 of empty string
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('should handle binary data', async () => {
      const content = new Uint8Array(Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE])).buffer;
      const hash = await calculateBufferHash(content);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // Valid hex string
    });

    it('should be case-insensitive for same content', async () => {
      const content1 = new Uint8Array(Buffer.from('Test Content')).buffer;
      const content2 = new Uint8Array(Buffer.from('Test Content')).buffer;

      const hash1 = await calculateBufferHash(content1);
      const hash2 = await calculateBufferHash(content2);

      expect(hash1).toBe(hash2);
    });
  });
});
