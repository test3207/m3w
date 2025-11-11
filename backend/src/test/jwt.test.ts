import { describe, it, expect } from 'vitest';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../lib/jwt';
import type { User } from '@m3w/shared';

describe('JWT Utilities', () => {
  const mockUser: User = {
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    image: 'https://example.com/avatar.jpg',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = generateAccessToken(mockUser);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('should generate token with correct payload', () => {
      const token = generateAccessToken(mockUser);
      const payload = verifyToken(token);
      
      expect(payload).toBeTruthy();
      expect(payload?.userId).toBe(mockUser.id);
      expect(payload?.email).toBe(mockUser.email);
      expect(payload?.type).toBe('access');
    });

    it('should generate different tokens for different users', () => {
      const user2: User = { ...mockUser, id: 'user-456', email: 'other@example.com' };
      const token1 = generateAccessToken(mockUser);
      const token2 = generateAccessToken(user2);
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken(mockUser);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('should generate token with correct type', () => {
      const token = generateRefreshToken(mockUser);
      const payload = verifyToken(token);
      
      expect(payload?.type).toBe('refresh');
      expect(payload?.userId).toBe(mockUser.id);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid tokens', () => {
      const token = generateAccessToken(mockUser);
      const payload = verifyToken(token);
      
      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe(mockUser.id);
    });

    it('should return null for invalid tokens', () => {
      const invalidToken = 'invalid.token.here';
      const payload = verifyToken(invalidToken);
      
      expect(payload).toBeNull();
    });

    it('should return null for malformed tokens', () => {
      const payload = verifyToken('not-a-jwt');
      expect(payload).toBeNull();
    });

    it('should return null for empty token', () => {
      const payload = verifyToken('');
      expect(payload).toBeNull();
    });
  });

  describe('Token expiry', () => {
    it('access and refresh tokens should have different structure', () => {
      const accessToken = generateAccessToken(mockUser);
      const refreshToken = generateRefreshToken(mockUser);
      
      // Tokens should be different
      expect(accessToken).not.toBe(refreshToken);
      
      // Both should be valid
      expect(verifyToken(accessToken)).toBeTruthy();
      expect(verifyToken(refreshToken)).toBeTruthy();
    });
  });
});
