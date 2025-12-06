import { describe, it, expect, beforeEach } from "vitest";
import { format, registerMessages, setLocale } from "./i18n";

describe("i18n format function", () => {
  beforeEach(() => {
    // Register test messages
    registerMessages("en", {
      common: {
        itemsCount: "{0} items",
        greetingWithName: "Hello {0}, welcome back!",
        dateRange: "From {0} to {1}",
        complexTemplate: "With the great {0} comes the great {1}",
      },
    });

    registerMessages("zh-CN", {
      common: {
        itemsCount: "共 {0} 项",
        greetingWithName: "你好 {0}，欢迎回来！",
        dateRange: "从 {0} 到 {1}",
        complexTemplate: "能力越大，{0}越大", // Different word order
      },
    });

    setLocale("en");
  });

  describe("basic replacement", () => {
    it("should replace single placeholder", () => {
      const template = "{0} items";
      const result = format(template, "5");
      expect(result).toBe("5 items");
    });

    it("should replace with number", () => {
      const template = "{0} items";
      const result = format(template, 42);
      expect(result).toBe("42 items");
    });

    it("should handle multiple placeholders in order", () => {
      const template = "From {0} to {1}";
      const result = format(template, "2025-01-01", "2025-12-31");
      expect(result).toBe("From 2025-01-01 to 2025-12-31");
    });

    it("should handle Chinese text with different word order", () => {
      setLocale("zh-CN");
      const template = "能力越大，{0}越大";
      const result = format(template, "责任");
      expect(result).toBe("能力越大，责任越大");
    });
  });

  describe("edge cases", () => {
    it("should handle empty replacements array", () => {
      const template = "No placeholders here";
      const result = format(template);
      expect(result).toBe("No placeholders here");
    });

    it("should ignore extra replacements", () => {
      const template = "{0} items";
      const result = format(template, "5", "extra", "values");
      expect(result).toBe("5 items");
    });

    it("should leave unreplaced placeholders as-is", () => {
      const template = "From {0} to {1}";
      const result = format(template, "2025-01-01");
      expect(result).toBe("From 2025-01-01 to {1}");
    });

    it("should handle special characters in replacement", () => {
      const template = "Hello {0}!";
      const result = format(template, "World & Universe");
      expect(result).toBe("Hello World & Universe!");
    });

    it("should handle empty string replacement", () => {
      const template = "{0} items";
      const result = format(template, "");
      expect(result).toBe(" items");
    });
  });

  describe("real-world usage", () => {
    it("should work with I18n proxy object value", () => {
      const template = "With the great {0} comes the great {1}";
      const result = format(template, "power", "responsibility");
      expect(result).toBe("With the great power comes the great responsibility");
    });

    it("should support different language word orders", () => {
      // English: "With the great X comes the great Y"
      setLocale("en");
      let template = "With the great {0} comes the great {1}";
      let result = format(template, "power", "responsibility");
      expect(result).toBe("With the great power comes the great responsibility");

      // Chinese: "能力越大，Y越大" (different structure)
      setLocale("zh-CN");
      template = "能力越大，{0}越大";
      result = format(template, "责任");
      expect(result).toBe("能力越大，责任越大");
    });

    it("should handle song metadata template", () => {
      const template = "{0} - {1} ({2})";
      const result = format(template, "Bohemian Rhapsody", "Queen", "1975");
      expect(result).toBe("Bohemian Rhapsody - Queen (1975)");
    });

    it("should handle user greeting", () => {
      const template = "Hello {0}, welcome back!";
      const result = format(template, "Alice");
      expect(result).toBe("Hello Alice, welcome back!");
    });
  });

  describe("locale switching", () => {
    it("should maintain correct replacements after locale change", () => {
      setLocale("en");
      let template = "{0} items";
      let result = format(template, "10");
      expect(result).toBe("10 items");

      setLocale("zh-CN");
      template = "共 {0} 项";
      result = format(template, "10");
      expect(result).toBe("共 10 项");
    });
  });
});
