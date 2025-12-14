/**
 * Storage Constants Tests
 *
 * Tests for storage-related configuration values
 */

import { describe, it, expect } from "vitest";
import {
  AVG_AUDIO_SIZE,
  AVG_COVER_SIZE,
  AVG_METADATA_SIZE,
  CRITICAL_THRESHOLD,
  WARNING_THRESHOLD,
  CACHE_SYNC_INTERVAL,
  CACHE_SYNC_BATCH_SIZE,
  CACHE_EXPIRY_TIME,
  CACHE_VALIDATOR_EXPIRY,
  METADATA_SYNC_INTERVAL,
} from "./storage-constants";

describe("Storage Constants", () => {
  describe("Storage Size Estimates", () => {
    it("should have AVG_AUDIO_SIZE as 5MB", () => {
      expect(AVG_AUDIO_SIZE).toBe(5 * 1024 * 1024);
    });

    it("should have AVG_COVER_SIZE as 100KB", () => {
      expect(AVG_COVER_SIZE).toBe(100 * 1024);
    });

    it("should have AVG_METADATA_SIZE as 10KB", () => {
      expect(AVG_METADATA_SIZE).toBe(10 * 1024);
    });
  });

  describe("Storage Warning Thresholds", () => {
    it("should have CRITICAL_THRESHOLD as 90%", () => {
      expect(CRITICAL_THRESHOLD).toBe(90);
    });

    it("should have WARNING_THRESHOLD as 80%", () => {
      expect(WARNING_THRESHOLD).toBe(80);
    });

    it("should have WARNING_THRESHOLD less than CRITICAL_THRESHOLD", () => {
      expect(WARNING_THRESHOLD).toBeLessThan(CRITICAL_THRESHOLD);
    });
  });

  describe("Cache Sync Configuration", () => {
    it("should have CACHE_SYNC_INTERVAL as 5 minutes", () => {
      expect(CACHE_SYNC_INTERVAL).toBe(5 * 60 * 1000);
    });

    it("should have CACHE_SYNC_BATCH_SIZE as 50", () => {
      expect(CACHE_SYNC_BATCH_SIZE).toBe(50);
    });

    it("should have CACHE_EXPIRY_TIME as 60 seconds", () => {
      expect(CACHE_EXPIRY_TIME).toBe(60 * 1000);
    });

    it("should have CACHE_VALIDATOR_EXPIRY as 1 minute", () => {
      expect(CACHE_VALIDATOR_EXPIRY).toBe(60 * 1000);
    });
  });

  describe("Metadata Sync Configuration", () => {
    it("should have METADATA_SYNC_INTERVAL as 5 minutes", () => {
      expect(METADATA_SYNC_INTERVAL).toBe(5 * 60 * 1000);
    });
  });

  describe("Sanity Checks", () => {
    it("should have reasonable audio file size estimate", () => {
      // 5MB is reasonable for high quality audio
      expect(AVG_AUDIO_SIZE).toBeGreaterThanOrEqual(1 * 1024 * 1024); // >= 1MB
      expect(AVG_AUDIO_SIZE).toBeLessThanOrEqual(20 * 1024 * 1024); // <= 20MB
    });

    it("should have reasonable cover art size estimate", () => {
      // 100KB is reasonable for compressed cover art
      expect(AVG_COVER_SIZE).toBeGreaterThanOrEqual(10 * 1024); // >= 10KB
      expect(AVG_COVER_SIZE).toBeLessThanOrEqual(1 * 1024 * 1024); // <= 1MB
    });

    it("should have reasonable sync intervals", () => {
      // Sync intervals should be at least 1 minute
      expect(CACHE_SYNC_INTERVAL).toBeGreaterThanOrEqual(60 * 1000);
      expect(METADATA_SYNC_INTERVAL).toBeGreaterThanOrEqual(60 * 1000);
    });

    it("should have reasonable batch size", () => {
      // Batch size should be between 1 and 1000
      expect(CACHE_SYNC_BATCH_SIZE).toBeGreaterThanOrEqual(1);
      expect(CACHE_SYNC_BATCH_SIZE).toBeLessThanOrEqual(1000);
    });
  });
});
