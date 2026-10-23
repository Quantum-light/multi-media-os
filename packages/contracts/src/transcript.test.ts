import { describe, expect, it } from "vitest";
import { Transcript, segmentsBetween, transcriptText, wordCount } from "./transcript";

const base = {
  language: "en",
  durationS: 60,
  provider: "assemblyai",
  segments: [
    { startS: 0, endS: 4, text: "Time is not a line." },
    { startS: 4, endS: 9, text: "It is something you live inside." },
    { startS: 20, endS: 26, text: "And that changes how you spend a Tuesday." },
  ],
};

describe("Transcript", () => {
  it("accepts a transcript and fills in what it can", () => {
    const parsed = Transcript.parse(base);
    expect(parsed.version).toBe(1);
    expect(parsed.segments[0]?.speaker).toBeNull();
    expect(parsed.model).toBeNull();
  });

  it("refuses a segment that ends before it starts", () => {
    const bad = { ...base, segments: [{ startS: 10, endS: 4, text: "backwards" }] };
    expect(Transcript.safeParse(bad).success).toBe(false);
  });

  it("refuses segments that are out of order, because every later step seeks by time", () => {
    const bad = { ...base, segments: [base.segments[1], base.segments[0]] };
    expect(Transcript.safeParse(bad).success).toBe(false);
  });

  it("refuses an empty transcript rather than pretending silence is a result", () => {
    expect(Transcript.safeParse({ ...base, segments: [] }).success).toBe(false);
  });
});

describe("reading a transcript", () => {
  const transcript = Transcript.parse(base);

  it("reads as prose", () => {
    expect(transcriptText(transcript)).toBe("Time is not a line. It is something you live inside. And that changes how you spend a Tuesday.");
  });

  it("counts words", () => {
    expect(wordCount(transcript)).toBe(5 + 6 + 8);
  });

  it("finds the segments a clip would quote, including partial overlaps", () => {
    expect(segmentsBetween(transcript, 3, 6).map((s) => s.startS)).toEqual([0, 4]);
  });

  it("gives back nothing for a window with no speech in it", () => {
    expect(segmentsBetween(transcript, 10, 19)).toEqual([]);
  });

  it("does not include a segment that merely touches the edge", () => {
    expect(segmentsBetween(transcript, 9, 20)).toEqual([]);
  });
});
