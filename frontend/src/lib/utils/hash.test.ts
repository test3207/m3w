import { describe, it, expect } from 'vitest';
import { calculateBufferHash } from './hash';

describe('Hash Utils', () => {
  describe('calculateBufferHash', () => {
    it('should generate consistent SHA256 hash for same content', () => {
      const content = Buffer.from('test content');
      const hash1 = calculateBufferHash(content);
      const hash2 = calculateBufferHash(content);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 produces 64 hex characters
    });

    it('should generate different hashes for different content', () => {
      const content1 = Buffer.from('test content 1');
      const content2 = Buffer.from('test content 2');
      
      const hash1 = calculateBufferHash(content1);
      const hash2 = calculateBufferHash(content2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should generate correct SHA256 hash', () => {
      // Known SHA256 hash for "hello world"
      const content = Buffer.from('hello world');
      const expectedHash = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
      
      const hash = calculateBufferHash(content);
      
      expect(hash).toBe(expectedHash);
    });

    it('should handle empty buffer', () => {
      const content = Buffer.from('');
      const hash = calculateBufferHash(content);
      
      // SHA256 of empty string
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('should handle binary data', () => {
      const content = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE]);
      const hash = calculateBufferHash(content);
      
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // Valid hex string
    });

    it('should be case-insensitive for same content', () => {
      const content1 = Buffer.from('Test Content');
      const content2 = Buffer.from('Test Content');
      
      const hash1 = calculateBufferHash(content1);
      const hash2 = calculateBufferHash(content2);
      
      expect(hash1).toBe(hash2);
    });
  });
});
