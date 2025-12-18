/**
 * Cross-Region Architecture Tests
 * 
 * Tests for multi-region user routing logic including:
 * - Redis key naming and TTL
 * - Token expiry functions
 * - Cross-region JWT payload structure
 */

import { describe, it, expect } from 'vitest';
import { 
  generateTokens, 
  verifyToken, 
  getRedisUserTTL, 
  getAccessTokenExpirySeconds, 
  getRefreshTokenExpirySeconds 
} from '../lib/jwt';
import type { User } from '@m3w/shared';

describe('Cross-Region Architecture', () => {
  const mockUser: User = {
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    image: 'https://example.com/avatar.jpg',
    homeRegion: 'jp',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('Token Expiry Functions', () => {
    it('getAccessTokenExpirySeconds should return default 6 hours', () => {
      const expiry = getAccessTokenExpirySeconds();
      // Default is 6 hours = 6 * 60 * 60 = 21600 seconds
      expect(expiry).toBe(21600);
    });

    it('getRefreshTokenExpirySeconds should return default 90 days', () => {
      const expiry = getRefreshTokenExpirySeconds();
      // Default is 90 days = 90 * 24 * 60 * 60 = 7776000 seconds
      expect(expiry).toBe(7776000);
    });

    it('getRedisUserTTL should match refresh token expiry', () => {
      const redisTTL = getRedisUserTTL();
      const refreshExpiry = getRefreshTokenExpirySeconds();
      // Redis TTL should sync with refresh token expiry
      expect(redisTTL).toBe(refreshExpiry);
    });
  });

  describe('Cross-Region JWT Structure', () => {
    it('should create JWT with homeRegion for local user', () => {
      const tokens = generateTokens(mockUser, 'jp', false);
      const payload = verifyToken(tokens.accessToken);

      expect(payload).toBeTruthy();
      expect(payload?.homeRegion).toBe('jp');
      expect(payload?.isRemote).toBe(false);
    });

    it('should create JWT with isRemote=true for cross-region user', () => {
      const tokens = generateTokens(mockUser, 'jp', true);
      const payload = verifyToken(tokens.accessToken);

      expect(payload).toBeTruthy();
      expect(payload?.homeRegion).toBe('jp');
      expect(payload?.isRemote).toBe(true);
    });

    it('refresh token should include homeRegion but not isRemote', () => {
      const tokens = generateTokens(mockUser, 'sea', true);
      const payload = verifyToken(tokens.refreshToken);

      expect(payload).toBeTruthy();
      expect(payload?.homeRegion).toBe('sea');
      // isRemote is intentionally omitted from refresh tokens
      // so it can be recalculated during token refresh
      expect(payload?.isRemote).toBeUndefined();
    });

    it('should support all region identifiers', () => {
      const regions = ['jp', 'sea', 'usw', 'default'];

      for (const region of regions) {
        const tokens = generateTokens(mockUser, region, false);
        const payload = verifyToken(tokens.accessToken);

        expect(payload?.homeRegion).toBe(region);
      }
    });
  });

  describe('Cross-Region User Object', () => {
    it('cross-region user should have consistent structure', () => {
      const now = new Date().toISOString();
      const crossRegionUser = {
        id: '12345',
        email: 'user@example.com',
        name: 'Cross Region User',
        image: 'https://github.com/avatar.jpg',
        homeRegion: 'sea',
        createdAt: now,
        updatedAt: now,
      };

      const tokens = generateTokens(crossRegionUser, 'sea', true);
      const payload = verifyToken(tokens.accessToken);

      expect(payload?.userId).toBe('12345');
      expect(payload?.email).toBe('user@example.com');
      expect(payload?.homeRegion).toBe('sea');
      expect(payload?.isRemote).toBe(true);
    });
  });

  describe('Redis Key Naming Convention', () => {
    it('should use m3w:github: prefix for Redis keys', () => {
      // This is a documentation test to ensure the Redis key format is documented
      // The actual key format is: m3w:github:${githubId}
      const githubId = 12345;
      const expectedKeyFormat = `m3w:github:${githubId}`;
      
      expect(expectedKeyFormat).toBe('m3w:github:12345');
    });
  });

  describe('Token Refresh with Region', () => {
    it('isRemote should be recalculable during refresh', () => {
      // Scenario: User registered in JP, accessing from SEA
      // During refresh, isRemote should be calculated as: homeRegion !== currentRegion
      
      const jpUser: User = { ...mockUser, homeRegion: 'jp' };
      const tokens = generateTokens(jpUser, 'jp', false);
      
      // Simulate refresh token verification
      const refreshPayload = verifyToken(tokens.refreshToken);
      expect(refreshPayload?.homeRegion).toBe('jp');
      
      // isRemote is not in refresh token - it should be calculated
      // based on: payload.homeRegion !== HOME_REGION env var
      expect(refreshPayload?.isRemote).toBeUndefined();
    });
  });
});
