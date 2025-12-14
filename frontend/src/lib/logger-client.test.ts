/**
 * Client logger tests
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
});
