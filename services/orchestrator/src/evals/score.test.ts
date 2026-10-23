import { describe, expect, it } from "vitest";
import { parseChapterLines, score } from "./score";

const approved = {
  title: "The Watch My Grandmother Gave Me | Human Time",
  description: "GG shares the story of her grandmother's watch and why time is something we only ever have together.",
  chapters: [{ atS: 0, title: "Welcome" }, { atS: 95, title: "The watch" }, { atS: 300, title: "Shared time" }],
};

describe("golden scoring", () => {
  it("rewards a draft that finds the same turns and words", () => {
    const s = score({ titleOptions: ["Something else", "My grandmother's watch"], description: "The story of my grandmother's watch, and why we only have time together.", chapters: [{ atS: 0, title: "Hi" }, { atS: 110, title: "Watch" }, { atS: 290, title: "Together" }] }, approved);
    expect(s.chapterRecall).toBe(1);
    expect(s.chapterCountRatio).toBe(1);
    expect(s.titleOverlap).toBeGreaterThan(0.3);
    expect(s.descriptionCoverage).toBeGreaterThan(0.5);
    expect(s.overall).toBeGreaterThan(0.7);
  });

  it("scores a poor draft low", () => {
    const s = score({ titleOptions: ["Ten time hacks"], description: "Productivity tips.", chapters: [] }, approved);
    expect(s.chapterRecall).toBe(0);
    expect(s.titleOverlap).toBeLessThan(0.2);
    expect(s.overall).toBeLessThan(0.15);
  });

  it("reads chapter lines as pasted from YouTube", () => {
    expect(parseChapterLines("0:00 Welcome\n1:35 - The watch\n(1:02:05) Shared time\nnot a chapter")).toEqual([
      { atS: 0, title: "Welcome" },
      { atS: 95, title: "The watch" },
      { atS: 3725, title: "Shared time" },
    ]);
  });
});
