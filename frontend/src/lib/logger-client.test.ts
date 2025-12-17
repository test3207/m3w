/**
 * Client logger tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "./logger-client";
import { db } from "./db/schema";

// Mock fetch globally
global.fetch = vi.fn();

describe("logger-client", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    
    // Clear pending logs from previous tests
    await db.pendingLogs.clear();
    
    // Reset fetch mock
    vi.mocked(fetch).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("logger.error", () => {
    it("should log error message with prefix", () => {
      logger.error("Test error");
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Client Error] Test error",
        undefined
      );
    });

    it("should log error with data object", () => {
      const data = { code: 500, details: "Server error" };
      logger.error("Test error", data);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Client Error] Test error",
        data
      );
    });

    it("should handle Error object as data", () => {
      const error = new Error("Something went wrong");
      logger.error("Operation failed", error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Client Error] Operation failed",
        error
      );
    });
  });

  describe("logger.warn", () => {
    it("should log warning message with prefix", () => {
      logger.warn("Test warning");
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[Client Warning] Test warning",
        undefined
      );
    });

    it("should log warning with data", () => {
      const data = { deprecated: "oldMethod" };
      logger.warn("Deprecation notice", data);
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[Client Warning] Deprecation notice",
        data
      );
    });
  });

  describe("logger.info", () => {
    it("should log info message with prefix", () => {
      logger.info("Test info");
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        "[Client Info] Test info",
        undefined
      );
    });

    it("should log info with data", () => {
      const data = { user: "test", action: "login" };
      logger.info("User action", data);
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        "[Client Info] User action",
        data
      );
    });
  });

  describe("logger.debug", () => {
    it("should log debug message with prefix in dev mode", () => {
      // In test environment, DEV is typically true
      logger.debug("Debug message");
      
      // Debug should be called since we're in dev mode during tests
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        "[Client Debug] Debug message",
        undefined
      );
    });

    it("should log debug with data", () => {
      const data = { step: 1, value: "test" };
      logger.debug("Debug step", data);
      
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        "[Client Debug] Debug step",
        data
      );
    });
  });

  describe("data types", () => {
    it("should handle null data", () => {
      logger.error("Error with null", null);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Client Error] Error with null",
        null
      );
    });

    it("should handle array data", () => {
      const data = [1, 2, 3];
      logger.info("Array data", data);
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        "[Client Info] Array data",
        data
      );
    });

    it("should handle primitive data", () => {
      logger.info("Number", 42);
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        "[Client Info] Number",
        42
      );

      logger.info("String", "value");
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        "[Client Info] String",
        "value"
      );

      logger.info("Boolean", true);
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        "[Client Info] Boolean",
        true
      );
    });

    it("should handle nested objects", () => {
      const data = {
        level1: {
          level2: {
            value: "deep"
          }
        }
      };
      logger.info("Nested object", data);
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        "[Client Info] Nested object",
        data
      );
    });
  });

  describe("retry mechanism", () => {
    it("should save logs to IndexedDB when backend is unavailable", async () => {
      // Mock fetch to fail
      vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

      // Log an error
      logger.error("Test error");

      // Wait for flush (simulate timeout)
      await new Promise(resolve => setTimeout(resolve, 5100));

      // Check that log was saved to IndexedDB
      const pendingLogs = await db.pendingLogs.toArray();
      expect(pendingLogs.length).toBeGreaterThan(0);
      expect(pendingLogs[0].message).toBe("Test error");
      expect(pendingLogs[0].level).toBe("error");
      expect(pendingLogs[0].retryCount).toBe(0);
    });

    it("should retry sending logs with exponential backoff", async () => {
      // First attempt fails
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));
      // Second attempt succeeds
      vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));

      // Log an error
      logger.error("Test error");

      // Wait for initial flush
      await new Promise(resolve => setTimeout(resolve, 5100));

      // Verify log was saved
      let pendingLogs = await db.pendingLogs.toArray();
      expect(pendingLogs.length).toBeGreaterThan(0);

      // Wait for retry (initial retry delay is 1 second)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Verify log was removed after successful retry
      pendingLogs = await db.pendingLogs.toArray();
      expect(pendingLogs.length).toBe(0);
    });

    it("should drop logs after max retry attempts", async () => {
      // All attempts fail
      vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

      // Log an error
      logger.error("Test error");

      // Wait for initial flush
      await new Promise(resolve => setTimeout(resolve, 5100));

      // Verify log was saved
      let pendingLogs = await db.pendingLogs.toArray();
      expect(pendingLogs.length).toBeGreaterThan(0);
      const logId = pendingLogs[0].id;

      // Simulate max retries by manually updating retry count
      await db.pendingLogs.update(logId, { 
        retryCount: 5, 
        nextRetry: Date.now() 
      });

      // Trigger retry
      await new Promise(resolve => setTimeout(resolve, 100));

      // Wait for retry to process
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Verify log was dropped
      pendingLogs = await db.pendingLogs.toArray();
      expect(pendingLogs.find(log => log.id === logId)).toBeUndefined();
    });

    it("should cleanup old logs", async () => {
      // Create an old log entry (8 days old)
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      await db.pendingLogs.add({
        id: "old-log",
        level: "error",
        message: "Old error",
        timestamp: oldDate.toISOString(),
        retryCount: 0,
        nextRetry: Date.now(),
        createdAt: oldDate,
      });

      // Mock successful fetch
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

      // Log a new error to trigger cleanup
      logger.error("New error");

      // Wait for flush
      await new Promise(resolve => setTimeout(resolve, 5100));

      // Verify old log was cleaned up
      const pendingLogs = await db.pendingLogs.toArray();
      expect(pendingLogs.find(log => log.id === "old-log")).toBeUndefined();
    });
  });
});
