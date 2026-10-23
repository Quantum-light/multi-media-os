import { describe, expect, it } from "vitest";
import { copyShape, correctionArgs, SUBJECTS } from "./corrections";

const EP = "81000000-0000-0000-0000-000000000004";

describe("one record of a correction", () => {
  it("shapes a correction for the one record", () => {
    expect(
      correctionArgs({ episodeId: EP, subject: "cut", proposed: { startS: 4 }, accepted: { startS: 7 }, note: "  let her finish  " }),
    ).toEqual({ p_episode: EP, p_subject: "cut", p_proposed: { startS: 4 }, p_accepted: { startS: 7 }, p_note: "let her finish" });
  });

  it("leaves the note out when the person gave none", () => {
    const args = correctionArgs({ episodeId: EP, subject: "clip", proposed: { rank: 1 }, accepted: { rank: 2 } });
    expect(args).not.toHaveProperty("p_note");
  });

  it("records nothing when the person changed nothing, whatever order the keys are in", () => {
    expect(correctionArgs({ episodeId: EP, subject: "schedule", proposed: { at: "09:00" }, accepted: { at: "09:00" } })).toBeNull();
    expect(
      correctionArgs({ episodeId: EP, subject: "graphic", proposed: { a: 1, b: [2, 3] }, accepted: { b: [2, 3], a: 1 } }),
    ).toBeNull();
    expect(correctionArgs({ episodeId: EP, subject: "graphic", proposed: { a: 1 }, accepted: { a: 2 } })).not.toBeNull();
    expect(correctionArgs({ episodeId: EP, subject: "graphic", proposed: { a: [1, 2] }, accepted: { a: [2, 1] } })).not.toBeNull();
  });

  it("refuses a kind of correction the record does not keep, and a note that runs on", () => {
    expect(() => correctionArgs({ episodeId: EP, subject: "vibes", proposed: {}, accepted: { a: 1 } })).toThrow();
    expect(() => correctionArgs({ episodeId: "not-an-episode", subject: "cut", proposed: {}, accepted: { a: 1 } })).toThrow();
    expect(() =>
      correctionArgs({ episodeId: EP, subject: "cut", proposed: {}, accepted: { a: 1 }, note: "x".repeat(301) }),
    ).toThrow();
  });

  it("keeps copy in the shape the record uses, and keeps the record's vocabulary", () => {
    expect(copyShape("caption", "instagram", "Hello")).toEqual({ kind: "caption", platform: "instagram", body: "Hello" });
    // The same five subjects as the check constraint on public.style_edits.
    expect([...SUBJECTS]).toEqual(["cut", "copy", "clip", "graphic", "schedule"]);
  });
});
