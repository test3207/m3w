/**
 * Pinyin Helper Tests
 *
 * Tests for Chinese text pinyin conversion utility
 */

import { describe, it, expect } from "vitest";
import { getPinyinSort } from "../lib/pinyin-helper";

describe("Pinyin Helper", () => {
  describe("getPinyinSort", () => {
    it("should convert Chinese characters to pinyin", () => {
      const result = getPinyinSort("你好");
      expect(result).toBe("ni hao");
    });

    it("should return lowercase pinyin", () => {
      const result = getPinyinSort("中国");
      expect(result).toBe("zhong guo");
    });

    it("should handle mixed Chinese and English", () => {
      const result = getPinyinSort("Hello世界");
      // nonZh: 'consecutive' keeps non-Chinese characters together
      expect(result).toBe("hello shi jie");
    });

    it("should pass through English text unchanged (lowercased)", () => {
      const result = getPinyinSort("Hello World");
      expect(result).toBe("hello world");
    });

    it("should handle empty string", () => {
      const result = getPinyinSort("");
      expect(result).toBe("");
    });

    it("should handle numbers", () => {
      const result = getPinyinSort("123");
      expect(result).toBe("123");
    });

    it("should handle special characters", () => {
      const result = getPinyinSort("!@#$%");
      expect(result).toBe("!@#$%");
    });

    it("should handle null/undefined gracefully", () => {
      // The function uses `text || ''` so null/undefined become empty string
      // @ts-expect-error - testing runtime behavior
      const resultNull = getPinyinSort(null);
      expect(resultNull).toBe("");

      // @ts-expect-error - testing runtime behavior  
      const resultUndefined = getPinyinSort(undefined);
      expect(resultUndefined).toBe("");
    });

    it("should remove tones from pinyin", () => {
      // 妈 (mā) should become "ma" without tone marks
      const result = getPinyinSort("妈妈");
      expect(result).toBe("ma ma");
      expect(result).not.toContain("ā");
    });

    it("should handle single Chinese character", () => {
      const result = getPinyinSort("我");
      expect(result).toBe("wo");
    });

    it("should handle long Chinese text", () => {
      const result = getPinyinSort("春眠不觉晓");
      expect(result).toBe("chun mian bu jue xiao");
    });

    it("should be suitable for sorting", () => {
      // These should sort alphabetically by pinyin
      const items = ["张三", "李四", "王五", "赵六"];
      const sorted = items.sort((a, b) => 
        getPinyinSort(a).localeCompare(getPinyinSort(b))
      );
      // li < wang < zhang < zhao
      expect(sorted).toEqual(["李四", "王五", "张三", "赵六"]);
    });
  });
});
