import { describe, it, expect } from "vitest";
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
});
