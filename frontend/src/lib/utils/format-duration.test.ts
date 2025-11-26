import { describe, expect, it } from "vitest";
import { formatDuration } from "./format-duration";

describe("formatDuration", () => {
  it("formats whole minutes and seconds", () => {
    expect(formatDuration(125)).toBe("2:05");
    expect(formatDuration(61)).toBe("1:01");
  });

  it("floors fractional seconds", () => {
    expect(formatDuration(59.9)).toBe("0:59");
  });

  it("returns placeholder for falsy or invalid values", () => {
    expect(formatDuration(null)).toBe("--");
    expect(formatDuration(undefined)).toBe("--");
    expect(formatDuration(NaN)).toBe("--");
    expect(formatDuration(0)).toBe("--");
  });
});
