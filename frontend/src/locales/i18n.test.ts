import { describe, it, expect, beforeEach, vi } from "vitest";
import { format, registerMessages, setLocale, getLocale, getAvailableLocales, onLocaleChange, I18n } from "./i18n";

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

describe("i18n core functions", () => {
  beforeEach(() => {
    registerMessages("en", {
      dashboard: { title: "Dashboard", welcome: "Welcome" },
      error: { unauthorized: "Unauthorized" },
    });
    registerMessages("zh-CN", {
      dashboard: { title: "仪表盘", welcome: "欢迎" },
      error: { unauthorized: "未授权" },
    });
    setLocale("en");
  });

  describe("getLocale", () => {
    it("should return current locale", () => {
      expect(getLocale()).toBe("en");
    });

    it("should return updated locale after setLocale", () => {
      setLocale("zh-CN");
      expect(getLocale()).toBe("zh-CN");
    });
  });

  describe("getAvailableLocales", () => {
    it("should return array of registered locales", () => {
      const locales = getAvailableLocales();
      expect(locales).toContain("en");
      expect(locales).toContain("zh-CN");
    });

    it("should include newly registered locale", () => {
      registerMessages("fr", { dashboard: { title: "Tableau de bord" } });
      const locales = getAvailableLocales();
      expect(locales).toContain("fr");
    });
  });

  describe("onLocaleChange", () => {
    it("should call listener when locale changes", () => {
      const listener = vi.fn();
      onLocaleChange(listener);

      setLocale("zh-CN");
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should call multiple listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      onLocaleChange(listener1);
      onLocaleChange(listener2);

      setLocale("zh-CN");
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it("should return unsubscribe function", () => {
      const listener = vi.fn();
      const unsubscribe = onLocaleChange(listener);

      setLocale("zh-CN");
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      setLocale("en");
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it("should not call listener when setting same locale fails", () => {
      const listener = vi.fn();
      onLocaleChange(listener);

      // Try to set unregistered locale (should fail silently)
      setLocale("de");
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("I18n proxy", () => {
    it("should access nested message via dot notation", () => {
      setLocale("en");
      expect(I18n.dashboard.title).toBe("Dashboard");
    });

    it("should return correct message for current locale", () => {
      setLocale("en");
      expect(I18n.dashboard.title).toBe("Dashboard");

      setLocale("zh-CN");
      expect(I18n.dashboard.title).toBe("仪表盘");
    });

    it("should access deeply nested messages", () => {
      setLocale("en");
      // error.unauthorized is registered in beforeEach and exists in the type
      const result = I18n.error.unauthorized;
      expect(typeof result).toBe("string");
      expect(result).toBe("Unauthorized");
    });
  });

  describe("setLocale edge cases", () => {
    it("should not change locale for unregistered locale", () => {
      setLocale("en");
      const originalLocale = getLocale();

      setLocale("unregistered-locale");
      expect(getLocale()).toBe(originalLocale);
    });
  });
});
