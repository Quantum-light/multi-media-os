import { describe, expect, it } from "vitest";
import { buildAnalysis, buildPieces, skipCuts, whenLabel } from "./review.build";

describe("review", () => {
  it("orders pieces for reading, with limits and newest version first", () => {
    const v = (version: number, author: string) => ({ version, body: `v${version}`, author, note: null, created_at: "2026-10-06T08:00:00Z" });
    const pieces = buildPieces([
      { id: "c", kind: "caption", platform: "threads", body: "t", version: 1, options: [], piece_versions: [v(1, "agent")] },
      { id: "t", kind: "title", platform: "", body: "T", version: 2, options: ["T", "U"], piece_versions: [v(1, "agent"), v(2, "chat")] },
      { id: "d", kind: "description", platform: "", body: "D", version: 1, options: [], piece_versions: [v(1, "agent")] },
    ]);
    expect(pieces.map((p) => [p.label, p.limit])).toEqual([["Title", 100], ["Description", 5000], ["Threads caption", 500]]);
    expect(pieces[0]!.versions.map((x) => [x.version, x.author])).toEqual([[2, "chat"], [1, "agent"]]);
  });

  it("reads step results through their contracts and ignores odd ones", () => {
    const a = buildAnalysis({ cut: { transcriptKey: "k", durationS: 60, cuts: [{ startS: 1, endS: 2, reason: "filler", text: "um" }], removedS: 1, keptS: 59 }, understand: { from: "test" }, clip: null });
    expect(a).toMatchObject({ durationS: 60, keptS: 59, cuts: [{ reason: "filler" }], summary: null, moments: [], clipSlate: null });
  });

  it("says how the slate came out, and says plainly when nothing cleared the bar", () => {
    const found = buildAnalysis({ cut: null, understand: null, clip: { target: 21, proposed: 30, chosen: 19, reserve: 4, shortfall: 2, model: "m" } });
    expect(found.clipSlate?.line).toBe("19 chosen of the 21 this episode wanted, 4 held in reserve.");
    const none = buildAnalysis({ cut: null, understand: null, clip: { target: 21, proposed: 3, chosen: 0, reserve: 0, shortfall: 21, model: "m" } });
    expect(none.clipSlate?.line).toBe("Nothing cleared the bar. This episode wanted 21.");
  });

  it("jumps over cuts, including ones that touch, and leaves kept time alone", () => {
    const cuts = [{ startS: 10, endS: 12 }, { startS: 12, endS: 13 }, { startS: 30, endS: 31 }];
    expect(skipCuts(5, cuts)).toBe(5);
    expect(skipCuts(10.2, cuts)).toBe(13);
    expect(skipCuts(30.99, cuts)).toBe(30.99);
  });

  it("says when a post goes out in the workspace's time zone", () => {
    expect(whenLabel("2026-10-13T01:00:00Z", "Asia/Makassar")).toBe("Tue 13 Oct, 09:00");
    expect(whenLabel(null, "UTC")).toBeNull();
  });
});
