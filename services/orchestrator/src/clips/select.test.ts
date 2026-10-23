import { describe, expect, it } from "vitest";
import type { ClipCandidate, ClipSignal } from "@mmos/contracts";
import { describeShortfall, overlapFraction, selectClips } from "./select";

function clip(startS: number, endS: number, score: number, signal: ClipSignal = "standalone_idea"): ClipCandidate {
  return { startS, endS, score, signal, hook: `h${startS}`, quote: `q${startS}`, reason: `r${startS}` };
}

describe("selectClips", () => {
  it("gives back the best first, and keeps the rest in reserve", () => {
    const plan = selectClips([clip(0, 30, 60), clip(100, 130, 90), clip(200, 230, 75)], { target: 2, ensureEachSignal: false });
    expect(plan.chosen.map((c) => c.score)).toEqual([90, 75]);
    expect(plan.reserve.map((c) => c.score)).toEqual([60]);
    expect(plan.shortfall).toBe(0);
  });

  it("treats the same moment as one clip, keeping the stronger cut of it", () => {
    const plan = selectClips([clip(100, 140, 70), clip(105, 145, 92)], { target: 5, ensureEachSignal: false });
    expect(plan.chosen).toHaveLength(1);
    expect(plan.chosen[0]?.score).toBe(92);
    expect(plan.reserve).toHaveLength(0);
  });

  it("keeps two clips that merely brush against each other", () => {
    const plan = selectClips([clip(100, 140, 70), clip(136, 176, 92)], { target: 5, ensureEachSignal: false });
    expect(plan.chosen).toHaveLength(2);
  });

  it("never pads the slate to hit the number", () => {
    const plan = selectClips([clip(0, 30, 80), clip(100, 130, 40)], { target: 21 });
    expect(plan.chosen).toHaveLength(1);
    expect(plan.shortfall).toBe(20);
    expect(describeShortfall(plan)).toContain("1 of the 21");
  });

  it("drops clips that are too short to watch or too long to be a short", () => {
    const plan = selectClips([clip(0, 4, 99), clip(10, 200, 99), clip(300, 330, 60)], { target: 5 });
    expect(plan.chosen).toHaveLength(1);
    expect(plan.chosen[0]?.startS).toBe(300);
  });

  it("gives every signal that found something a place before filling by score", () => {
    const candidates = [
      clip(0, 30, 95, "standalone_idea"),
      clip(100, 130, 94, "standalone_idea"),
      clip(200, 230, 93, "standalone_idea"),
      clip(300, 330, 60, "personal"),
      clip(400, 430, 55, "surprising"),
    ];
    const plan = selectClips(candidates, { target: 3 });
    expect(plan.chosen.map((c) => c.signal)).toEqual(["standalone_idea", "personal", "surprising"]);
    expect(plan.reserve.map((c) => c.score)).toEqual([94, 93]);
  });

  it("falls back to pure score when variety is switched off", () => {
    const candidates = [clip(0, 30, 95), clip(100, 130, 94), clip(300, 330, 60, "personal")];
    const plan = selectClips(candidates, { target: 2, ensureEachSignal: false });
    expect(plan.chosen.map((c) => c.score)).toEqual([95, 94]);
  });

  it("is deterministic when two clips score the same", () => {
    const a = selectClips([clip(500, 530, 80), clip(100, 130, 80)], { target: 1, ensureEachSignal: false });
    const b = selectClips([clip(100, 130, 80), clip(500, 530, 80)], { target: 1, ensureEachSignal: false });
    expect(a.chosen[0]?.startS).toBe(100);
    expect(b.chosen[0]?.startS).toBe(100);
  });

  it("says so plainly when an episode gave nothing", () => {
    const plan = selectClips([clip(0, 30, 10)], { target: 21 });
    expect(plan.chosen).toHaveLength(0);
    expect(describeShortfall(plan)).toContain("Nothing in this episode");
  });

  it("says nothing when the slate is full", () => {
    const plan = selectClips([clip(0, 30, 80), clip(100, 130, 70)], { target: 2 });
    expect(describeShortfall(plan)).toBeNull();
  });
});

describe("overlapFraction", () => {
  it("is zero for clips that do not touch", () => {
    expect(overlapFraction(clip(0, 30, 50), clip(40, 70, 50))).toBe(0);
  });

  it("measures against the shorter clip, so a long one cannot hide a short one", () => {
    expect(overlapFraction(clip(0, 100, 50), clip(90, 110, 50))).toBe(0.5);
  });

  it("is one when a clip sits entirely inside another", () => {
    expect(overlapFraction(clip(0, 100, 50), clip(20, 40, 50))).toBe(1);
  });
});
