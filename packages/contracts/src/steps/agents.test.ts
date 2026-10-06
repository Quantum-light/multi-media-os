import { describe, expect, it } from "vitest";
import { CutOutput, isRemoved, toEditedTime } from "./cut";
import { ClipCandidate } from "./clip";
import { PublishInput } from "./publish";
import { StoryboardOutput } from "./storyboard";
import { TranscribeOutput, TranscriptDoc } from "./transcribe";
import { Understanding } from "./understand";
import { Draft, WriteOutput, stamp, youtubeChapters } from "./write";

const transcribed = {
  transcriptKey: "ws/a/episodes/b/derived/transcript.json",
  provider: "assemblyai",
  providerRef: "tr_123",
  language: "en",
  durationS: 660,
  wordCount: 1800,
  speakers: ["A"],
  text: "Welcome to Human Time.",
} as const;

describe("transcribe contract", () => {
  it("accepts a real output and rejects an unknown provider or empty speaker", () => {
    expect(TranscribeOutput.safeParse(transcribed).success).toBe(true);
    expect(TranscribeOutput.safeParse({ ...transcribed, provider: "whisper" }).success).toBe(false);
    expect(TranscribeOutput.safeParse({ ...transcribed, speakers: [""] }).success).toBe(false);
  });
  it("keeps word timings whole milliseconds and confidence between 0 and 1", () => {
    const doc = { version: 1, provider: "assemblyai", providerRef: "x", language: "en", durationS: 2, utterances: [], words: [{ text: "hi", startMs: 0, endMs: 300, confidence: 0.9, speaker: "A" }] };
    expect(TranscriptDoc.safeParse(doc).success).toBe(true);
    expect(TranscriptDoc.safeParse({ ...doc, words: [{ ...doc.words[0], confidence: 1.4 }] }).success).toBe(false);
    expect(TranscriptDoc.safeParse({ ...doc, words: [{ ...doc.words[0], startMs: 0.5 }] }).success).toBe(false);
  });
});

describe("cut contract and the edited timeline", () => {
  const cuts = [
    { startS: 10, endS: 12, reason: "silence", text: "" },
    { startS: 30, endS: 35, reason: "retake", text: "so the thing is" },
  ] as const;
  it("accepts a cut list and rejects a cut that ends before it starts", () => {
    const ok = { transcriptKey: "k", durationS: 60, cuts, removedS: 7, keptS: 53 };
    expect(CutOutput.safeParse(ok).success).toBe(true);
    expect(CutOutput.safeParse({ ...ok, cuts: [{ startS: 5, endS: 4, reason: "silence", text: "" }] }).success).toBe(false);
    expect(CutOutput.safeParse({ ...ok, cuts: [{ startS: 5, endS: 6, reason: "boring", text: "" }] }).success).toBe(false);
  });
  it("moves source times onto the edited timeline", () => {
    expect(toEditedTime(5, cuts)).toBe(5);
    expect(toEditedTime(11, cuts)).toBe(10);
    expect(toEditedTime(20, cuts)).toBe(18);
    expect(toEditedTime(40, cuts)).toBe(33);
    expect(isRemoved(31, cuts)).toBe(true);
    expect(isRemoved(35, cuts)).toBe(false);
  });
});

describe("understand contract", () => {
  const ok = {
    summary: "GG on time as something we make together.",
    chapters: [{ startS: 0, title: "Welcome" }],
    moments: [{ startS: 12, endS: 40, kind: "story", quote: "When I was nine...", why: "A personal story that opens the theme" }],
    themes: [{ name: "Shared time", slug: "shared-time" }],
    pillars: [{ pillar: "Human time", score: 0.8, evidence: "The whole episode" }],
  };
  it("accepts a real understanding and rejects bad kinds, slugs and scores", () => {
    expect(Understanding.safeParse(ok).success).toBe(true);
    expect(Understanding.safeParse({ ...ok, moments: [{ ...ok.moments[0], kind: "joke" }] }).success).toBe(false);
    expect(Understanding.safeParse({ ...ok, themes: [{ name: "x", slug: "Shared Time" }] }).success).toBe(false);
    expect(Understanding.safeParse({ ...ok, pillars: [{ ...ok.pillars[0], score: 2 }] }).success).toBe(false);
    expect(Understanding.safeParse({ ...ok, chapters: [] }).success).toBe(false);
  });
});

describe("write contract", () => {
  it("holds captions to each platform's limit", () => {
    const draft = { titleOptions: ["One", "Two"], description: "About time.", captions: [{ platform: "threads", body: "x".repeat(500) }] };
    expect(Draft.safeParse(draft).success).toBe(true);
    expect(Draft.safeParse({ ...draft, captions: [{ platform: "threads", body: "x".repeat(501) }] }).success).toBe(false);
    expect(Draft.safeParse({ ...draft, titleOptions: ["x".repeat(101), "y"] }).success).toBe(false);
    expect(WriteOutput.safeParse({ title: "One", titleOptions: ["One"], description: "d", chapters: [], chaptersText: "", captions: [], model: "m" }).success).toBe(true);
  });
  it("formats YouTube timestamps and keeps only chapters YouTube will show", () => {
    expect(stamp(0)).toBe("0:00");
    expect(stamp(75.9)).toBe("1:15");
    expect(stamp(3725)).toBe("1:02:05");
    const kept = youtubeChapters([{ atS: 4, title: "Hello" }, { atS: 8, title: "Too soon" }, { atS: 60, title: "Middle" }, { atS: 300, title: "End" }], 400);
    expect(kept).toEqual([{ atS: 0, title: "Hello" }, { atS: 60, title: "Middle" }, { atS: 300, title: "End" }]);
    expect(youtubeChapters([{ atS: 0, title: "a" }, { atS: 60, title: "b" }], 400)).toEqual([]);
  });
});

describe("clip, storyboard and publish contracts", () => {
  it("keeps clips between 15 and 90 seconds", () => {
    const c = { startS: 10, endS: 50, kind: "teaching", title: "Why time feels short", quote: "..." };
    expect(ClipCandidate.safeParse(c).success).toBe(true);
    expect(ClipCandidate.safeParse({ ...c, endS: 20 }).success).toBe(false);
    expect(ClipCandidate.safeParse({ ...c, endS: 200 }).success).toBe(false);
  });
  it("accepts a storyboard and rejects unknown blocks", () => {
    const ok = { editedDurationS: 600, cues: [{ atS: 0, durationS: 5, block: "lower_third", text: "GG" }] };
    expect(StoryboardOutput.safeParse(ok).success).toBe(true);
    expect(StoryboardOutput.safeParse({ ...ok, cues: [{ ...ok.cues[0], block: "spinner" }] }).success).toBe(false);
  });
  it("needs an idempotency key and a real time to publish", () => {
    const ok = { postId: "6f1d3a0e-8d1c-4c64-9a35-2f5a7a0d9c11", platform: "youtube", accountId: "acc_1", content: "Hi", media: [], scheduledFor: "2026-10-10T08:00:00Z", idempotencyKey: "post-6f1d3a0e" };
    expect(PublishInput.safeParse(ok).success).toBe(true);
    expect(PublishInput.safeParse({ ...ok, idempotencyKey: "short" }).success).toBe(false);
    expect(PublishInput.safeParse({ ...ok, scheduledFor: "tomorrow" }).success).toBe(false);
  });
});
