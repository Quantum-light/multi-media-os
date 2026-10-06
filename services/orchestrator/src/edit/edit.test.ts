import { describe, expect, it } from "vitest";
import { wordsFrom } from "../testing/fakes";
import { merge, planCuts, removedSeconds } from "./cut-plan";
import { planClips, planCues } from "./shorts-plan";

describe("cut plan", () => {
  it("shortens long pauses but keeps breathing room", () => {
    const { words, durationS } = wordsFrom("Welcome to the show || today we talk about time");
    const cuts = planCuts(words, durationS);
    const pause = cuts.find((c) => c.reason === "silence" && c.startS > 1);
    expect(pause).toBeDefined();
    expect(pause!.endS - pause!.startS).toBeCloseTo(3.1 - 0.6, 1);
  });

  it("removes fillers and stutters, leaving real doubles alone", () => {
    const { words, durationS } = wordsFrom("So um I I think that that is what time had had done");
    const cuts = planCuts(words, durationS);
    expect(cuts.filter((c) => c.reason === "filler").map((c) => c.text)).toEqual(["um"]);
    expect(cuts.filter((c) => c.reason === "false_start").map((c) => c.text)).toEqual(["I"]);
  });

  it("drops the first attempt of a retake and keeps the second", () => {
    const { words, durationS } = wordsFrom("The thing about time is that we never really the thing about time is that we share it");
    const cuts = planCuts(words, durationS);
    const retake = cuts.find((c) => c.reason === "retake");
    expect(retake?.text).toBe("The thing about time is that we never really");
    expect(retake?.startS).toBeCloseTo(0.5, 2);
  });

  it("leaves a clean take untouched and never overlaps cuts", () => {
    const { words, durationS } = wordsFrom("Time is the one thing we all share and nobody can make more of it");
    expect(planCuts(words, durationS)).toEqual([]);
    const merged = merge([
      { startS: 1, endS: 3, reason: "silence", text: "" },
      { startS: 2.5, endS: 4, reason: "retake", text: "x" },
      { startS: 6, endS: 7, reason: "filler", text: "um" },
    ]);
    expect(merged).toEqual([
      { startS: 1, endS: 4, reason: "retake", text: "x" },
      { startS: 6, endS: 7, reason: "filler", text: "um" },
    ]);
    expect(removedSeconds(merged)).toBe(4);
  });
});

describe("clips and cues", () => {
  const moments = [
    { startS: 100, endS: 140, kind: "claim" as const, quote: "Time is relational. It lives between people.", why: "x" },
    { startS: 10, endS: 60, kind: "story" as const, quote: "When I was nine my grandmother gave me a watch.", why: "x" },
    { startS: 20, endS: 50, kind: "teaching" as const, quote: "Overlapping story", why: "x" },
    { startS: 200, endS: 205, kind: "question" as const, quote: "What would you do with one more hour?", why: "x" },
    { startS: 300, endS: 340, kind: "practice" as const, quote: "Mostly cut", why: "x" },
  ];
  const cuts = [{ startS: 300, endS: 330, reason: "retake" as const, text: "" }];

  it("picks the strongest non-overlapping moments, 15 to 90 seconds, avoiding cut stretches", () => {
    const clips = planClips(moments, cuts, 400);
    expect(clips.map((c) => c.kind)).toEqual(["story", "claim", "question"]);
    expect(clips[2]!.endS - clips[2]!.startS).toBe(15);
    expect(clips[0]!.title).toBe("When I was nine my grandmother gave me a watch.");
  });

  it("places a lower third, chapter cards, quote cards and an end card on the edited timeline", () => {
    const cues = planCues({ showName: "Human Time with GG", chapters: [{ atS: 0, title: "Welcome" }, { atS: 70, title: "The watch" }], moments, cuts, editedDurationS: 370 });
    expect(cues.map((c) => c.block)).toEqual(["lower_third", "quote_card", "chapter_card", "quote_card", "end_card"]);
    expect(cues.find((c) => c.atS === 70)).toMatchObject({ block: "chapter_card", text: "The watch" });
    expect(cues.at(-1)).toMatchObject({ atS: 355, block: "end_card" });
  });
});
