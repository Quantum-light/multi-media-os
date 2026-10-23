import { describe, expect, it } from "vitest";
import { ClipCandidate, ClipPlan, ClipSignal } from "./clip";

const candidate = {
  startS: 124,
  endS: 158,
  signal: "surprising" as const,
  score: 86,
  hook: "Everyone has this backwards.",
  quote: "Everyone has this backwards. You do not find time, you decide what time is for.",
  reason: "Opens on a flat contradiction of what the viewer expects, and resolves it inside thirty seconds.",
};

describe("ClipCandidate", () => {
  it("accepts a candidate the finder would produce", () => {
    expect(ClipCandidate.safeParse(candidate).success).toBe(true);
  });

  it("insists on a hook, a quote and a reason, so nothing is unexplained", () => {
    for (const field of ["hook", "quote", "reason"] as const) {
      expect(ClipCandidate.safeParse({ ...candidate, [field]: "" }).success, field).toBe(false);
    }
  });

  it("refuses a clip that ends before it starts", () => {
    expect(ClipCandidate.safeParse({ ...candidate, endS: 100 }).success).toBe(false);
  });

  it("keeps the score on a scale that means something", () => {
    expect(ClipCandidate.safeParse({ ...candidate, score: 101 }).success).toBe(false);
    expect(ClipCandidate.safeParse({ ...candidate, score: -1 }).success).toBe(false);
  });

  it("only knows the four signals Grace chose", () => {
    expect(ClipSignal.options).toEqual(["standalone_idea", "opening_line", "surprising", "personal"]);
    expect(ClipCandidate.safeParse({ ...candidate, signal: "engaging" }).success).toBe(false);
  });
});

describe("ClipPlan", () => {
  it("records the target and what it actually found", () => {
    const plan = ClipPlan.parse({ target: 21, chosen: [candidate], reserve: [], shortfall: 20 });
    expect(plan.version).toBe(1);
    expect(plan.shortfall).toBe(20);
  });

  it("allows an episode that produced nothing worth cutting", () => {
    expect(ClipPlan.safeParse({ target: 21, chosen: [], reserve: [], shortfall: 21 }).success).toBe(true);
  });
});
