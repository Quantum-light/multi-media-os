import { describe, expect, it } from "vitest";
import {
  asState,
  buildSlate,
  countLine,
  lengthLabel,
  mmss,
  newestRun,
  scoreLabel,
  shortfallLine,
  signalLabel,
  span,
  type ClipRow,
} from "./clips.build";

function row(over: Partial<ClipRow> & { rank: number }): ClipRow {
  return {
    id: `c${over.rank}`,
    job_id: "job-new",
    state: "chosen",
    signal: "standalone_idea",
    score: 80,
    start_s: 252,
    end_s: 308,
    hook: "Time is not a line.",
    quote: "Time is not a line, it is a room you are standing in.",
    reason: "It makes sense with nothing around it.",
    decided_at: null,
    created_at: "2026-10-20T10:00:00Z",
    ...over,
  };
}

describe("timestamps", () => {
  it("reads seconds as m:ss", () => {
    expect(mmss(252)).toBe("4:12");
    expect(mmss(0)).toBe("0:00");
    expect(mmss(9)).toBe("0:09");
    expect(mmss(3_605)).toBe("60:05");
    expect(mmss(252.9)).toBe("4:12");
  });

  it("gives a clip its place in the recording", () => {
    expect(span(252, 308)).toBe("4:12-5:08");
  });

  it("says how long a clip runs", () => {
    expect(lengthLabel(252, 308)).toBe("56 seconds");
    expect(lengthLabel(10, 11)).toBe("1 second");
  });
});

describe("labels", () => {
  it("puts the four signals in her words", () => {
    expect(signalLabel("standalone_idea")).toBe("Stands alone");
    expect(signalLabel("opening_line")).toBe("Opening line");
    expect(signalLabel("surprising")).toBe("Surprising");
    expect(signalLabel("personal")).toBe("Personal");
    expect(signalLabel("something_new")).toBe("something new");
  });

  it("keeps whole scores whole", () => {
    expect(scoreLabel(80)).toBe("80");
    expect(scoreLabel(80.25)).toBe("80.3");
  });

  it("treats an unknown state as reserve rather than losing the clip", () => {
    expect(asState("approved")).toBe("approved");
    expect(asState("parked")).toBe("reserve");
  });
});

describe("newestRun", () => {
  it("shows one run only, the newest, in rank order", () => {
    const rows = [
      row({ rank: 2, job_id: "job-old", created_at: "2026-10-01T10:00:00Z" }),
      row({ rank: 3, job_id: "job-new", created_at: "2026-10-20T10:00:00Z" }),
      row({ rank: 1, job_id: "job-new", created_at: "2026-10-20T10:00:00Z" }),
      row({ rank: 1, job_id: "job-old", created_at: "2026-10-01T10:00:00Z" }),
    ];
    const run = newestRun(rows);
    expect(run.map((r) => r.job_id)).toEqual(["job-new", "job-new"]);
    expect(run.map((r) => r.rank)).toEqual([1, 3]);
  });

  it("has nothing to show when no run has happened", () => {
    expect(newestRun([])).toEqual([]);
  });
});

describe("buildSlate", () => {
  const rows = [
    row({ rank: 1, state: "approved", decided_at: "2026-10-21T09:00:00Z" }),
    row({ rank: 2, state: "chosen", signal: "opening_line", score: 74.5 }),
    row({ rank: 3, state: "rejected", decided_at: "2026-10-21T09:01:00Z" }),
    row({ rank: 4, state: "reserve", signal: "personal", start_s: 600, end_s: 645 }),
    row({ rank: 5, state: "reserve" }),
  ];

  it("groups the chosen from the reserve and keeps rank order", () => {
    const slate = buildSlate(rows, 4);
    expect(slate.chosen.map((c) => c.rank)).toEqual([1, 2]);
    expect(slate.reserve.map((c) => c.rank)).toEqual([4, 5]);
    expect(slate.setAside.map((c) => c.rank)).toEqual([3]);
    expect(slate.jobId).toBe("job-new");
    expect(slate.empty).toBe(false);
  });

  it("counts approved clips as standing, and says so", () => {
    const slate = buildSlate(rows, 4);
    expect(slate.standing).toBe(2);
    expect(slate.approved).toBe(1);
    expect(slate.countLine).toBe("2 chosen of the 4 this episode wanted. 1 of them has been approved.");
  });

  it("says plainly when the episode came up short", () => {
    const slate = buildSlate(rows, 4);
    expect(slate.shortfall).toBe(2);
    expect(slate.shortfallLine).toContain("came up 2 short");
    expect(slate.shortfallLine).toContain("2 clips are held in reserve");
  });

  it("says nothing about a shortfall when the episode met its target", () => {
    const slate = buildSlate([row({ rank: 1 }), row({ rank: 2 })], 2);
    expect(slate.shortfall).toBe(0);
    expect(slate.shortfallLine).toBeNull();
    expect(slate.countLine).toBe("2 chosen of the 2 this episode wanted.");
  });

  it("carries each clip's signal, score and place in the recording", () => {
    const slate = buildSlate(rows, 4);
    const second = slate.chosen[1]!;
    expect(second.signal).toBe("Opening line");
    expect(second.score).toBe("74.5");
    expect(second.span).toBe("4:12-5:08");
    expect(second.decided).toBe(false);
    expect(slate.chosen[0]!.decided).toBe(true);
    expect(slate.reserve[0]!.span).toBe("10:00-10:45");
  });

  it("is an honest blank when the finder has not run", () => {
    const slate = buildSlate([], null);
    expect(slate.empty).toBe(true);
    expect(slate.chosen).toEqual([]);
    expect(slate.reserve).toEqual([]);
    expect(slate.jobId).toBeNull();
    expect(slate.countLine).toBe("Nothing is chosen yet.");
    expect(slate.shortfallLine).toBeNull();
  });

  it("admits when the run did not say how many the episode wanted", () => {
    const slate = buildSlate([row({ rank: 1 })], null);
    expect(slate.countLine).toBe("1 chosen. This run did not say how many the episode wanted.");
    expect(slate.shortfall).toBe(0);
  });
});

describe("the sentences on their own", () => {
  it("counts without an approval when none is approved", () => {
    expect(countLine(7, 21)).toBe("7 chosen of the 21 this episode wanted.");
    expect(countLine(7, 21, 2)).toBe("7 chosen of the 21 this episode wanted. 2 of them have been approved.");
  });

  it("says where the rest would have to come from when the reserve is empty", () => {
    expect(shortfallLine(3, 0)).toContain("nothing else that clears the bar");
    expect(shortfallLine(1, 1)).toContain("1 clip is held in reserve");
    expect(shortfallLine(0, 5)).toBeNull();
  });
});
