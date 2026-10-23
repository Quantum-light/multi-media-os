import { describe, expect, it } from "vitest";
import { cleanPhrase, clock, likePattern, mentionsLabel, occurrences, snippetAround, split } from "./map.build";

const plain = (s: ReturnType<typeof snippetAround>) => (s === null ? null : s.parts.map((p) => p.text).join(""));

describe("cleanPhrase", () => {
  it("tidies the edges and refuses a phrase too short to search", () => {
    expect(cleanPhrase("  quantum   light  ")).toBe("quantum light");
    expect(cleanPhrase("a")).toBe("");
    expect(cleanPhrase("")).toBe("");
    expect(cleanPhrase(null)).toBe("");
    expect(cleanPhrase(undefined)).toBe("");
    expect(cleanPhrase("x".repeat(400))).toHaveLength(120);
  });
});

describe("likePattern", () => {
  it("takes the person's own wildcards literally", () => {
    expect(likePattern("growth")).toBe("%growth%");
    expect(likePattern("100%")).toBe("%100\\%%");
    expect(likePattern("a_b")).toBe("%a\\_b%");
    expect(likePattern("back\\slash")).toBe("%back\\\\slash%");
  });
});

describe("occurrences", () => {
  it("finds every mention, ignoring case, and never loops on an empty phrase", () => {
    expect(occurrences("Time and time again", "time")).toEqual([0, 9]);
    expect(occurrences("nothing here", "quantum")).toEqual([]);
    expect(occurrences("anything", "")).toEqual([]);
  });
});

describe("snippetAround", () => {
  const text = "We opened the studio in March. The whole point of quantum light is that it is ordinary. Then we went home.";

  it("returns the sentence holding the phrase, with the phrase picked out", () => {
    const snippet = snippetAround(text, "quantum light");
    expect(plain(snippet)).toBe("The whole point of quantum light is that it is ordinary.");
    expect(snippet!.parts.filter((p) => p.hit)).toEqual([{ text: "quantum light", hit: true }]);
    expect(snippet!.trimmedStart).toBe(false);
    expect(snippet!.trimmedEnd).toBe(false);
  });

  it("keeps the case as it was said, not as it was typed", () => {
    expect(plain(snippetAround(text, "QUANTUM LIGHT"))).toContain("quantum light");
  });

  it("treats a line break as the end of a sentence", () => {
    const lines = "First line about growth\nSecond line about something else";
    expect(plain(snippetAround(lines, "growth"))).toBe("First line about growth");
  });

  it("cuts a long sentence back to the words either side, without breaking a word", () => {
    const long = `${"filler words ".repeat(40)}the phrase here ${"more filler ".repeat(40)}`;
    const snippet = snippetAround(long, "the phrase here")!;
    expect(snippet.trimmedStart).toBe(true);
    expect(snippet.trimmedEnd).toBe(true);
    expect(plain(snippet)).toContain("the phrase here");
    expect(plain(snippet)!.length).toBeLessThan(280);
    expect(plain(snippet)!.startsWith("filler")).toBe(true);
  });

  it("gives back nothing when the phrase is not there", () => {
    expect(snippetAround(text, "aubergine")).toBeNull();
  });
});

describe("split", () => {
  it("splits a line on every mention", () => {
    expect(split("Time and time again", "time")).toEqual([
      { text: "Time", hit: true },
      { text: " and ", hit: false },
      { text: "time", hit: true },
      { text: " again", hit: false },
    ]);
  });

  it("leaves a line with no mention whole, and an empty line empty", () => {
    expect(split("nothing here", "growth")).toEqual([{ text: "nothing here", hit: false }]);
    expect(split("", "growth")).toEqual([]);
  });
});

describe("clock", () => {
  it("reads as a timestamp", () => {
    expect(clock(252)).toBe("4:12");
    expect(clock(0)).toBe("0:00");
    expect(clock(9)).toBe("0:09");
    expect(clock(3730)).toBe("1:02:10");
    expect(clock(252.7)).toBe("4:12");
  });

  it("says nothing when there is no timing", () => {
    expect(clock(null)).toBeNull();
    expect(clock(-1)).toBeNull();
    expect(clock(Number.NaN)).toBeNull();
  });
});

describe("mentionsLabel", () => {
  it("only speaks up when there is more than one", () => {
    expect(mentionsLabel(1)).toBeNull();
    expect(mentionsLabel(3)).toBe("3 mentions here");
  });
});
