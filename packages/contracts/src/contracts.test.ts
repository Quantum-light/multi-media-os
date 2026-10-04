import { describe, expect, it } from "vitest";
import { BrandKit, Compass, stepsFor, defineStep, StepName } from "./index";
import { z } from "zod";

describe("pipeline", () => {
  it("podcasts skip the video-only steps", () => {
    expect(stepsFor("podcast")).not.toContain("clip");
    expect(stepsFor("podcast")).not.toContain("storyboard");
    expect(stepsFor("video")).toHaveLength(StepName.options.length);
  });

  it("defineStep marks video-only steps automatically", () => {
    const step = defineStep({ name: "clip", input: z.object({}), output: z.object({}) });
    expect(step.videoOnly).toBe(true);
  });
});

describe("brand kit", () => {
  const valid = {
    version: 1,
    story: "Science for everyday people, with a regal feel.",
    fonts: {
      display: { family: "Cinzel", source: "google" },
      base: { family: "Satoshi", source: "upload", licenceConfirmed: true },
    },
    colours: { ground: "#2A1D16", accent: "#CD9936", ink: "#F2E6C8" },
    motion: "thread",
  };

  it("accepts a valid kit", () => {
    expect(BrandKit.safeParse(valid).success).toBe(true);
  });

  it("rejects named colours", () => {
    const bad = { ...valid, colours: { ...valid.colours, accent: "gold" } };
    expect(BrandKit.safeParse(bad).success).toBe(false);
  });

  it("allows at most three personas", () => {
    const persona = { name: "Seeker", description: "Curious about time" };
    const bad = { ...valid, personas: [persona, persona, persona, persona] };
    expect(BrandKit.safeParse(bad).success).toBe(false);
  });
});

describe("compass", () => {
  it("requires exactly three objectives under the main goal", () => {
    const kpi = { name: "Returning viewers", current: 34, target: 45, unit: "%", evidenceSource: "youtube_analytics.returning_viewers" };
    const base = {
      whatItIs: "The human side of Quantum Light Science",
      mission: "Help everyday people understand time",
      pillars: ["Personal growth and time"],
      vision: "The show people turn to when they want time explained",
      mainGoal: { statement: "A trusted twice-weekly show", by: "2027-10-01", objectives: [{ title: "Show up", kpis: [kpi] }] },
    };
    expect(Compass.safeParse(base).success).toBe(false);
    const three = { ...base, mainGoal: { ...base.mainGoal, objectives: [1, 2, 3].map((n) => ({ title: `Objective ${n}`, kpis: [kpi] })) } };
    expect(Compass.safeParse(three).success).toBe(true);
  });
});
