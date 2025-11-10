import { describe, it, expect } from 'vitest';
import { getUserId } from '../lib/auth-helper';
import type { Context } from 'hono';

describe('Auth Helper', () => {
  describe('getUserId', () => {
    it('should extract userId from authenticated context', () => {
      const mockContext = {
        get: (key: string) => {
          if (key === 'auth') {
            return { userId: 'user-123', email: 'test@example.com' };
          }
          return undefined;
        },
      } as unknown as Context;

      const userId = getUserId(mockContext);
      expect(userId).toBe('user-123');
    });

    it('should throw error when auth is missing', () => {
      const mockContext = {
        get: () => undefined,
      } as unknown as Context;

      expect(() => getUserId(mockContext)).toThrow('User not authenticated');
    });

    it('should throw error when userId is missing', () => {
      const mockContext = {
        get: (key: string) => {
          if (key === 'auth') {
            return { email: 'test@example.com' };
          }
          return undefined;
        },
      } as unknown as Context;

      expect(() => getUserId(mockContext)).toThrow('User not authenticated');
    });

    it('should throw error when auth.userId is null', () => {
      const mockContext = {
        get: (key: string) => {
          if (key === 'auth') {
            return { userId: null };
          }
          return undefined;
        },
      } as unknown as Context;

      expect(() => getUserId(mockContext)).toThrow('User not authenticated');
    });
  });
});
