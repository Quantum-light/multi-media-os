import { describe, expect, it } from "vitest";
import { formatBytes, formatEta } from "./format";

describe("upload formatting", () => {
  it("formats sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(2_300_000_000)).toBe("2.3 GB");
    expect(formatBytes(640_000_000)).toBe("640 MB");
  });
  it("formats time left", () => {
    expect(formatEta(0.2)).toBe("1 s");
    expect(formatEta(185)).toBe("3 min");
    expect(formatEta(4320)).toBe("1 h 12 min");
    expect(formatEta(Number.NaN)).toBe("—");
  });
});
