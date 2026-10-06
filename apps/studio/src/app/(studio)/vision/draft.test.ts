import { describe, expect, it } from "vitest";
import { Compass } from "@mmos/contracts";
import { emptyDraft, fromCompass, toCompass } from "./draft";

const kpi = (name: string) => ({ name, current: 1, target: 8, unit: "", evidenceSource: `src.${name}` });
const valid: Compass = {
  whatItIs: "The human side of QLS.",
  mission: "Help people understand time.",
  pillars: ["Time", "Science"],
  howYouSeeIt: "Regal but everyday.",
  isDraft: true,
  vision: "The show people turn to.",
  mainGoal: {
    statement: "Become a trusted twice-weekly show",
    by: "2027-10-01",
    objectives: [
      { title: "Show up", kpis: [kpi("episodes")] },
      { title: "Earn trust", kpis: [kpi("returning")] },
      { title: "Reach them", kpis: [kpi("match")] },
    ],
  },
};

describe("vision draft", () => {
  it("survives a round trip unchanged", () => {
    const back = Compass.safeParse(toCompass(fromCompass(valid)));
    expect(back.success).toBe(true);
    if (back.success) expect(back.data).toEqual(valid);
  });

  it("starts empty, and an empty one is not accepted as finished", () => {
    const parsed = Compass.safeParse(toCompass(emptyDraft()));
    expect(parsed.success).toBe(false);
  });

  it("drops blank pillars and keeps the order of the rest", () => {
    const draft = { ...fromCompass(valid), pillars: ["Time", "  ", "", "Science"] };
    const parsed = Compass.safeParse(toCompass(draft));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.pillars).toEqual(["Time", "Science"]);
  });

  it("trims the words people type", () => {
    const draft = { ...fromCompass(valid), whatItIs: "  A show.  ", statement: " A goal " };
    const parsed = Compass.safeParse(toCompass(draft));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.whatItIs).toBe("A show.");
      expect(parsed.data.mainGoal.statement).toBe("A goal");
    }
  });

  it("refuses a blank number rather than quietly saving zero", () => {
    const draft = fromCompass(valid);
    draft.objectives[0].kpis[0]!.target = "";
    expect(Compass.safeParse(toCompass(draft)).success).toBe(false);
  });

  it("ignores a half-started number row, so an empty extra row is harmless", () => {
    const draft = fromCompass(valid);
    draft.objectives[0].kpis.push({ name: "", current: "", target: "", unit: "", evidenceSource: "" });
    const parsed = Compass.safeParse(toCompass(draft));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.mainGoal.objectives[0]!.kpis).toHaveLength(1);
  });

  it("keeps every objective, so three stay three", () => {
    const draft = fromCompass(valid);
    expect(draft.objectives).toHaveLength(3);
    const parsed = Compass.safeParse(toCompass(draft));
    expect(parsed.success).toBe(true);
  });
});
