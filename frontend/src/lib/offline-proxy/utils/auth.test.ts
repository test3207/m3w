import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getUserId, isGuestUser, invalidateGuestCache, GUEST_USER_ID, isGuestUserId } from "./auth";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] || null),
  };
})();

// Storage key used by Zustand persist
const AUTH_STORAGE_KEY = "auth-storage";

describe("auth utilities", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", localStorageMock);
    localStorageMock.clear();
    invalidateGuestCache(); // Reset cache between tests
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("GUEST_USER_ID", () => {
    it("should be a UUID format constant", () => {
      expect(GUEST_USER_ID).toBe("00000000-0000-0000-0000-000000000000");
    });
  });

  describe("isGuestUserId", () => {
    it("should return true for GUEST_USER_ID", () => {
      expect(isGuestUserId(GUEST_USER_ID)).toBe(true);
    });

    it("should return false for regular user IDs", () => {
      expect(isGuestUserId("user-123")).toBe(false);
      expect(isGuestUserId("550e8400-e29b-41d4-a716-446655440000")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isGuestUserId("")).toBe(false);
    });
  });

  describe("getUserId", () => {
    it("should throw when no auth state exists", () => {
      expect(() => getUserId()).toThrow("Not authenticated");
    });

    it("should throw for invalid JSON", () => {
      localStorageMock.setItem(AUTH_STORAGE_KEY, "invalid-json");
      expect(() => getUserId()).toThrow();
    });

    it("should return empty string when user is not in auth state", () => {
      localStorageMock.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ state: {} })
      );
      expect(getUserId()).toBe("");
    });

    it("should return empty string when user.id is not present", () => {
      localStorageMock.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ state: { user: {} } })
      );
      expect(getUserId()).toBe("");
    });

    it("should return user.id when present", () => {
      localStorageMock.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ state: { user: { id: "user-123" } } })
      );
      expect(getUserId()).toBe("user-123");
    });

    it("should return GUEST_USER_ID for guest users", () => {
      localStorageMock.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ state: { user: { id: GUEST_USER_ID } } })
      );
      expect(getUserId()).toBe(GUEST_USER_ID);
    });
  });

  describe("isGuestUser", () => {
    it("should return false when no auth state exists", () => {
      // No auth state means not logged in at all, not a guest
      expect(isGuestUser()).toBe(false);
    });

    it("should return true when isGuest flag is true", () => {
      localStorageMock.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ state: { isGuest: true } })
      );
      expect(isGuestUser()).toBe(true);
    });

    it("should return false when isGuest flag is false", () => {
      localStorageMock.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ state: { isGuest: false, user: { id: "user-123" } } })
      );
      expect(isGuestUser()).toBe(false);
    });

    it("should return false when isGuest flag is not present", () => {
      localStorageMock.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ state: { user: { id: "user-123" } } })
      );
      expect(isGuestUser()).toBe(false);
    });

    it("should use cached value on subsequent calls", () => {
      localStorageMock.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ state: { isGuest: true } })
      );
      
      // First call
      expect(isGuestUser()).toBe(true);
      expect(localStorageMock.getItem).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      expect(isGuestUser()).toBe(true);
      expect(localStorageMock.getItem).toHaveBeenCalledTimes(1);
    });
  });

  describe("invalidateGuestCache", () => {
    it("should be a function", () => {
      expect(typeof invalidateGuestCache).toBe("function");
    });

    it("should not throw when called", () => {
      expect(() => invalidateGuestCache()).not.toThrow();
    });

    it("should clear cache so next isGuestUser call re-reads localStorage", () => {
      localStorageMock.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ state: { isGuest: true } })
      );
      
      // First call - reads from localStorage
      expect(isGuestUser()).toBe(true);
      expect(localStorageMock.getItem).toHaveBeenCalledTimes(1);
      
      // Change the stored value
      localStorageMock.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ state: { isGuest: false } })
      );
      
      // Without invalidation, still returns cached value
      expect(isGuestUser()).toBe(true);
      
      // Invalidate and check again
      invalidateGuestCache();
      expect(isGuestUser()).toBe(false);
      expect(localStorageMock.getItem).toHaveBeenCalledTimes(2);
    });
  });
});
