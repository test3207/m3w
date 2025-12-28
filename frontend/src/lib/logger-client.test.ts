/**
 * Client logger tests
 *
 * Tests for the unified frontend logger API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "./logger-client";

describe("logger-client", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("logger.error", () => {
    it("should log error message with source", () => {
      logger.error("[Test][error]", "Test error");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Error] [Test][error] Test error",
        undefined,
        ""
      );
    });

    it("should log error with Error object", () => {
      const error = new Error("Something went wrong");
      logger.error("[Test][error]", "Operation failed", error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Error] [Test][error] Operation failed",
        error,
        ""
      );
    });

    it("should log error with raw data", () => {
      const raw = { code: 500, details: "Server error" };
      logger.error("[Test][error]", "Test error", undefined, { raw });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Error] [Test][error] Test error",
        undefined,
        { code: 500, details: "Server error" }
      );
    });

    it("should log error with both Error and raw data", () => {
      const error = new Error("Something went wrong");
      const raw = { requestId: "req-123" };
      logger.error("[Test][error]", "Operation failed", error, { raw });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Error] [Test][error] Operation failed",
        error,
        { requestId: "req-123" }
      );
    });
  });

  describe("logger.warn", () => {
    it("should log warning message with source", () => {
      logger.warn("[Test][warn]", "Test warning");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[Warn] [Test][warn] Test warning",
        ""
      );
    });

    it("should log warning with raw data", () => {
      const raw = { deprecated: "oldMethod" };
      logger.warn("[Test][warn]", "Deprecation notice", { raw });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[Warn] [Test][warn] Deprecation notice",
        { deprecated: "oldMethod" }
      );
    });
  });

  describe("logger.info", () => {
    it("should log info message with source", () => {
      logger.info("[Test][info]", "Test info");

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        "[Info] [Test][info] Test info",
        ""
      );
    });

    it("should log info with raw data", () => {
      const raw = { user: "test", action: "login" };
      logger.info("[Test][info]", "User action", { raw });

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        "[Info] [Test][info] User action",
        { user: "test", action: "login" }
      );
    });
  });

  describe("logger.debug", () => {
    it("should log debug message in dev mode", () => {
      logger.debug("[Test][debug]", "Debug message");

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        "[Debug] [Test][debug] Debug message",
        ""
      );
    });

    it("should log debug with raw data", () => {
      const raw = { step: 1, value: "test" };
      logger.debug("[Test][debug]", "Debug step", { raw });

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        "[Debug] [Test][debug] Debug step",
        { step: 1, value: "test" }
      );
    });
  });

  describe("data types", () => {
    it("should handle array in raw data", () => {
      const raw = { items: [1, 2, 3] };
      logger.info("[Test][info]", "Array data", { raw });

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        "[Info] [Test][info] Array data",
        { items: [1, 2, 3] }
      );
    });

    it("should handle nested objects in raw data", () => {
      const raw = {
        level1: {
          level2: {
            value: "deep",
          },
        },
      };
      logger.info("[Test][info]", "Nested object", { raw });

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        "[Info] [Test][info] Nested object",
        {
          level1: {
            level2: {
              value: "deep",
            },
          },
        }
      );
    });
  });

  describe("tracing", () => {
    it("should generate new trace on startTrace", () => {
      const trace = logger.startTrace("/test");

      expect(trace).toBeTruthy();
      expect(trace.traceId).toBeTruthy();
      expect(typeof trace.traceId).toBe("string");
    });

    it("should allow trace methods", () => {
      const trace = logger.startTrace("/test");
      
      // These should not throw
      trace.info("[Test][trace]", "Trace info");
      trace.warn("[Test][trace]", "Trace warn");
      trace.error("[Test][trace]", "Trace error");
      trace.debug("[Test][trace]", "Trace debug");
      trace.end();
    });
  });

  describe("debug mode", () => {
    // Note: URL-based debug mode is tested through integration behavior
    // since window.location cannot be easily mocked in browser environment.
    // The caching mechanism improves performance by avoiding repeated 
    // sessionStorage access.
    
    it("should handle sessionStorage persistence", () => {
      const getItemSpy = vi.spyOn(Storage.prototype, "getItem");
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
      
      // Logger reads from sessionStorage when checking debug mode
      logger.debug("[Test][debug]", "Test message");
      
      // In dev mode, debug always shows but sessionStorage should be checked
      expect(consoleDebugSpy).toHaveBeenCalled();
      
      // Cleanup
      getItemSpy.mockRestore();
      setItemSpy.mockRestore();
    });

    it("should log debug messages in dev mode regardless of debug filter", () => {
      // In dev mode (import.meta.env.DEV = true), debug logs are always shown
      logger.debug("[MediaSession][test]", "Media message");
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        "[Debug] [MediaSession][test] Media message",
        ""
      );
    });

    it("should log info messages in dev mode regardless of debug filter", () => {
      // In dev mode, info logs are always shown
      logger.info("[AudioPlayer][test]", "Audio message");
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        "[Info] [AudioPlayer][test] Audio message",
        ""
      );
    });
  });
});
