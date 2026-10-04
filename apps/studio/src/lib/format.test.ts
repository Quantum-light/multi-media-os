import { describe, expect, it } from "vitest";
import { dayKey, dayLabel, greeting, initials, listJoin, overallProgress, plural, safeNext, shortDay } from "./format";

describe("initials", () => {
  it("takes first letters, at most three", () => {
    expect(initials("Quantum Light Science")).toBe("QLS");
    expect(initials("  one   two three four ")).toBe("OTT");
    expect(initials("")).toBe("·");
  });
});

describe("time zone formatting", () => {
  // 23:30 UTC on Sat 3 Oct is already Sunday morning in Bali (UTC+8).
  const late = new Date("2026-10-03T23:30:00Z");
  it("reads the day in the workspace time zone, not the server's", () => {
    expect(dayKey(late, "UTC")).toBe("2026-10-03");
    expect(dayKey(late, "Asia/Makassar")).toBe("2026-10-04");
    expect(dayLabel(late, "Asia/Makassar")).toBe("Sunday 4 October");
    expect(shortDay(late, "Asia/Makassar")).toBe("Sun 4");
  });
  it("greets by local hour", () => {
    expect(greeting(late, "Asia/Makassar")).toBe("Good morning");
    expect(greeting(late, "UTC")).toBe("Good evening");
    expect(greeting(new Date("2026-10-04T14:00:00Z"), "UTC")).toBe("Good afternoon");
  });
});

describe("safeNext", () => {
  it("keeps same-site paths only", () => {
    expect(safeNext("/vision")).toBe("/vision");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});

describe("overallProgress", () => {
  it("averages capped progress", () => {
    expect(overallProgress([])).toBe(0);
    expect(overallProgress([{ current: 1, target: 8 }, { current: 10, target: 5 }])).toBe(56);
    expect(overallProgress([{ current: -3, target: 5 }, { current: 0, target: 0 }])).toBe(50);
  });
});

describe("words", () => {
  it("pluralises and joins", () => {
    expect(plural(1, "episode")).toBe("1 episode");
    expect(plural(2, "story", "stories")).toBe("2 stories");
    expect(listJoin([])).toBe("");
    expect(listJoin(["a"])).toBe("a");
    expect(listJoin(["a", "b", "c"])).toBe("a, b and c");
  });
});
