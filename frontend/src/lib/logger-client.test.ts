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
        raw
      );
    });

    it("should log error with both Error and raw data", () => {
      const error = new Error("Something went wrong");
      const raw = { requestId: "req-123" };
      logger.error("[Test][error]", "Operation failed", error, { raw });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Error] [Test][error] Operation failed",
        error,
        raw
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
        raw
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
        raw
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
        raw
      );
    });
  });

  describe("data types", () => {
    it("should handle array in raw data", () => {
      const raw = { items: [1, 2, 3] };
      logger.info("[Test][info]", "Array data", { raw });

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        "[Info] [Test][info] Array data",
        raw
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
        raw
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
});
