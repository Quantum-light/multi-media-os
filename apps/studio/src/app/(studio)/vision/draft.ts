import type { Compass } from "@mmos/contracts";

/** Numbers stay as text while editing, so a field can be empty without snapping back to 0. */
export type KpiDraft = { name: string; current: string; target: string; unit: string; evidenceSource: string };
export type ObjectiveDraft = { title: string; kpis: KpiDraft[] };
export type Objectives = [ObjectiveDraft, ObjectiveDraft, ObjectiveDraft];

export type CompassDraft = {
  whatItIs: string;
  mission: string;
  howYouSeeIt: string;
  vision: string;
  pillars: string[];
  statement: string;
  by: string;
  objectives: Objectives;
  isDraft: boolean;
};

export const emptyKpi = (): KpiDraft => ({ name: "", current: "", target: "", unit: "", evidenceSource: "" });
const emptyObjective = (): ObjectiveDraft => ({ title: "", kpis: [emptyKpi()] });

/** A blank compass, ready to fill in. Hand-typed numbers start as a draft. */
export function emptyDraft(): CompassDraft {
  return {
    whatItIs: "",
    mission: "",
    howYouSeeIt: "",
    vision: "",
    pillars: [""],
    statement: "",
    by: "",
    objectives: [emptyObjective(), emptyObjective(), emptyObjective()],
    isDraft: true,
  };
}

export function fromCompass(compass: Compass): CompassDraft {
  const objective = (i: number): ObjectiveDraft => {
    const o = compass.mainGoal.objectives[i];
    if (!o) return emptyObjective();
    return {
      title: o.title,
      kpis: o.kpis.map((k) => ({ name: k.name, current: String(k.current), target: String(k.target), unit: k.unit, evidenceSource: k.evidenceSource })),
    };
  };
  return {
    whatItIs: compass.whatItIs,
    mission: compass.mission,
    howYouSeeIt: compass.howYouSeeIt,
    vision: compass.vision,
    pillars: compass.pillars.length > 0 ? [...compass.pillars] : [""],
    statement: compass.mainGoal.statement,
    by: compass.mainGoal.by,
    objectives: [objective(0), objective(1), objective(2)],
    isDraft: compass.isDraft ?? true,
  };
}

/** The shape the contract checks. Blank lines are dropped; numbers are read, never guessed. */
export function toCompass(draft: CompassDraft): unknown {
  const number = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));
  return {
    whatItIs: draft.whatItIs.trim(),
    mission: draft.mission.trim(),
    howYouSeeIt: draft.howYouSeeIt.trim(),
    vision: draft.vision.trim(),
    pillars: draft.pillars.map((p) => p.trim()).filter((p) => p !== ""),
    isDraft: draft.isDraft,
    mainGoal: {
      statement: draft.statement.trim(),
      by: draft.by,
      objectives: draft.objectives.map((o) => ({
        title: o.title.trim(),
        kpis: o.kpis
          .filter((k) => k.name.trim() !== "" || k.evidenceSource.trim() !== "")
          .map((k) => ({ name: k.name.trim(), current: number(k.current), target: number(k.target), unit: k.unit.trim(), evidenceSource: k.evidenceSource.trim() })),
      })),
    },
  };
}
