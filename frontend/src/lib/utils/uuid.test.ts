import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateUUID } from "./uuid";

describe("UUID Utils", () => {
  describe("generateUUID", () => {
    it("should generate a valid UUID v4 format", () => {
      const uuid = generateUUID();

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      // where y is 8, 9, a, or b
      const uuidV4Regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(uuid).toMatch(uuidV4Regex);
    });

    it("should have correct length (36 characters)", () => {
      const uuid = generateUUID();
      expect(uuid.length).toBe(36);
    });

    it("should have dashes at correct positions", () => {
      const uuid = generateUUID();
      expect(uuid[8]).toBe("-");
      expect(uuid[13]).toBe("-");
      expect(uuid[18]).toBe("-");
      expect(uuid[23]).toBe("-");
    });

    it("should generate different UUIDs on each call", () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      const uuid3 = generateUUID();

      expect(uuid1).not.toBe(uuid2);
      expect(uuid2).not.toBe(uuid3);
      expect(uuid1).not.toBe(uuid3);
    });

    it("should have version 4 indicator", () => {
      const uuid = generateUUID();
      // Position 14 (0-indexed) should be '4' for version 4
      expect(uuid[14]).toBe("4");
    });

    it("should have correct variant bits", () => {
      const uuid = generateUUID();
      // Position 19 (0-indexed) should be 8, 9, a, or b for RFC4122 variant
      expect(uuid[19]).toMatch(/[89ab]/i);
    });

    it("should generate 100 unique UUIDs without collision", () => {
      const uuids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        uuids.add(generateUUID());
      }
      expect(uuids.size).toBe(100);
    });
  });

  describe("generateUUID fallback behavior", () => {
    const originalRandomUUID = crypto.randomUUID;

    beforeEach(() => {
      // Force fallback by removing randomUUID
      vi.stubGlobal("crypto", {
        ...crypto,
        randomUUID: undefined,
      });
    });

    afterEach(() => {
      // Restore original crypto
      vi.stubGlobal("crypto", {
        ...crypto,
        randomUUID: originalRandomUUID,
      });
    });

    it("should generate valid UUID when randomUUID is unavailable", () => {
      const uuid = generateUUID();

      const uuidV4Regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(uuid).toMatch(uuidV4Regex);
    });

    it("should have correct length in fallback mode", () => {
      const uuid = generateUUID();
      expect(uuid.length).toBe(36);
    });

    it("should have correct version 4 in fallback mode", () => {
      const uuid = generateUUID();
      expect(uuid[14]).toBe("4");
    });

    it("should have correct variant bits in fallback mode", () => {
      const uuid = generateUUID();
      expect(uuid[19]).toMatch(/[89ab]/i);
    });

    it("should generate unique UUIDs in fallback mode", () => {
      const uuids = new Set<string>();
      for (let i = 0; i < 50; i++) {
        uuids.add(generateUUID());
      }
      expect(uuids.size).toBe(50);
    });

    it("should have dashes at correct positions in fallback mode", () => {
      const uuid = generateUUID();
      expect(uuid[8]).toBe("-");
      expect(uuid[13]).toBe("-");
      expect(uuid[18]).toBe("-");
      expect(uuid[23]).toBe("-");
    });
  });

  describe("generateUUID with getRandomValues fallback", () => {
    const originalCrypto = globalThis.crypto;

    beforeEach(() => {
      // Remove both randomUUID and getRandomValues to test Math.random fallback
      vi.stubGlobal("crypto", {
        getRandomValues: undefined,
        randomUUID: undefined,
      });
    });

    afterEach(() => {
      vi.stubGlobal("crypto", originalCrypto);
    });

    it("should generate valid UUID with Math.random fallback", () => {
      const uuid = generateUUID();

      const uuidV4Regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(uuid).toMatch(uuidV4Regex);
    });

    it("should have correct length with Math.random fallback", () => {
      const uuid = generateUUID();
      expect(uuid.length).toBe(36);
    });

    it("should have version 4 with Math.random fallback", () => {
      const uuid = generateUUID();
      expect(uuid[14]).toBe("4");
    });

    it("should have correct variant with Math.random fallback", () => {
      const uuid = generateUUID();
      expect(uuid[19]).toMatch(/[89ab]/i);
    });
  });

  describe("UUID format validation", () => {
    it("should only contain valid hex characters", () => {
      const uuid = generateUUID();
      const hexPart = uuid.replace(/-/g, "");
      expect(hexPart).toMatch(/^[0-9a-f]{32}$/i);
    });

    it("should have exactly 5 parts when split by dash", () => {
      const uuid = generateUUID();
      const parts = uuid.split("-");
      expect(parts.length).toBe(5);
    });

    it("should have correct part lengths (8-4-4-4-12)", () => {
      const uuid = generateUUID();
      const parts = uuid.split("-");
      expect(parts[0].length).toBe(8);
      expect(parts[1].length).toBe(4);
      expect(parts[2].length).toBe(4);
      expect(parts[3].length).toBe(4);
      expect(parts[4].length).toBe(12);
    });

    it("should be lowercase or uppercase hex consistently", () => {
      const uuid = generateUUID();
      const hexPart = uuid.replace(/-/g, "");
      // Either all lowercase or all uppercase (depends on implementation)
      const isLowerCase = hexPart === hexPart.toLowerCase();
      const isUpperCase = hexPart === hexPart.toUpperCase();
      expect(isLowerCase || isUpperCase).toBe(true);
    });
  });
});
