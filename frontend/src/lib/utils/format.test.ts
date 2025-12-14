/**
 * Format Utilities Tests
 *
 * Tests for format utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatDuration, formatFileSize, formatRelativeTime } from "./format";

// Mock the i18n module
vi.mock("@/locales/i18n", () => ({
  I18n: {
    common: {
      timeAgo: {
        justNow: "just now",
        minutesAgo: "{0} minutes ago",
        hoursAgo: "{0} hours ago",
        daysAgo: "{0} days ago",
      },
    },
  },
}));

describe("Format Utilities", () => {
  describe("formatDuration", () => {
    it("should format seconds to MM:SS", () => {
      expect(formatDuration(65)).toBe("1:05");
    });

    it("should format minutes without leading zero", () => {
      expect(formatDuration(125)).toBe("2:05");
    });

    it("should format single digit seconds with leading zero", () => {
      expect(formatDuration(63)).toBe("1:03");
    });

    it("should format zero seconds", () => {
      expect(formatDuration(0)).toBe("0:00");
    });

    it("should handle NaN", () => {
      expect(formatDuration(NaN)).toBe("0:00");
    });

    it("should handle undefined", () => {
      // @ts-expect-error - testing undefined
      expect(formatDuration(undefined)).toBe("0:00");
    });

    it("should format hours to HH:MM:SS", () => {
      expect(formatDuration(3665)).toBe("1:01:05");
    });

    it("should pad minutes and seconds when hours present", () => {
      expect(formatDuration(3601)).toBe("1:00:01");
    });

    it("should handle large durations", () => {
      expect(formatDuration(36000)).toBe("10:00:00");
    });
  });

  describe("formatFileSize", () => {
    it("should format bytes", () => {
      expect(formatFileSize(500)).toBe("500 B");
    });

    it("should format kilobytes", () => {
      expect(formatFileSize(1024)).toBe("1 KB");
    });

    it("should format megabytes", () => {
      expect(formatFileSize(1024 * 1024)).toBe("1 MB");
    });

    it("should format gigabytes", () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
    });

    it("should format with decimals", () => {
      expect(formatFileSize(1536)).toBe("1.5 KB");
    });

    it("should handle zero", () => {
      expect(formatFileSize(0)).toBe("0 B");
    });

    it("should handle large files", () => {
      expect(formatFileSize(5.5 * 1024 * 1024 * 1024)).toBe("5.5 GB");
    });

    it("should round to 2 decimal places", () => {
      expect(formatFileSize(1234567)).toBe("1.18 MB");
    });
  });

  describe("formatRelativeTime", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should format just now", () => {
      const date = new Date("2024-06-15T11:59:50Z"); // 10 seconds ago
      expect(formatRelativeTime(date)).toBe("just now");
    });

    it("should format minutes ago", () => {
      const date = new Date("2024-06-15T11:30:00Z"); // 30 minutes ago
      expect(formatRelativeTime(date)).toBe("30 minutes ago");
    });

    it("should format hours ago", () => {
      const date = new Date("2024-06-15T09:00:00Z"); // 3 hours ago
      expect(formatRelativeTime(date)).toBe("3 hours ago");
    });

    it("should format days ago", () => {
      const date = new Date("2024-06-12T12:00:00Z"); // 3 days ago
      expect(formatRelativeTime(date)).toBe("3 days ago");
    });

    it("should format as date for more than 7 days", () => {
      const date = new Date("2024-06-01T12:00:00Z"); // 14 days ago
      const result = formatRelativeTime(date);
      // Should be a date string, not relative time
      expect(result).not.toContain("ago");
    });

    it("should accept string date input", () => {
      const result = formatRelativeTime("2024-06-15T11:30:00Z");
      expect(result).toBe("30 minutes ago");
    });

    it("should handle Date object input", () => {
      const date = new Date("2024-06-15T11:30:00Z");
      expect(formatRelativeTime(date)).toBe("30 minutes ago");
    });
  });
});
