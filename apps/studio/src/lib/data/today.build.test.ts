import { describe, expect, it } from "vitest";
import { buildToday, type TodayRows } from "./today.build";

const SHOW = "s1";
const base: TodayRows = {
  shows: [{ id: SHOW, name: "Human Time with GG", kind: "video", theme: { ground: "#2A1D16" }, compass: { mission: "x" }, channels: 3 }],
  episodes: [],
  jobs: [],
  posts: [],
  failedJobsThisWeek: 0,
};
const now = new Date("2026-10-04T01:00:00Z"); // Sunday 09:00 in Bali

describe("buildToday", () => {
  it("is calm and honest when nothing is happening", () => {
    const t = buildToday(base, now, "Asia/Makassar");
    expect(t.dateLabel).toBe("Sunday 4 October");
    expect(t.greeting).toBe("Good morning");
    expect(t.forYou).toEqual([]);
    expect(t.inStudio).toEqual([]);
    expect(t.week).toHaveLength(7);
    expect(t.week.every((d) => d.items === "Nothing scheduled")).toBe(true);
    expect(t.summary).toMatch(/quiet day/);
    expect(t.healthy).toBe(true);
  });

  it("asks for setup on shows without a vision or channels", () => {
    const t = buildToday({ ...base, shows: [{ ...base.shows[0]!, compass: null, channels: 0 }] }, now, "UTC");
    expect(t.forYou.map((f) => f.kind)).toEqual(["setup", "setup"]);
    expect(t.summary).toMatch(/quiet day/);
  });

  it("shows review, work in progress, the week and health", () => {
    const rows: TodayRows = {
      ...base,
      episodes: [
        { id: "e1", title: "What Is Time, Really?", state: "review", show_id: SHOW, created_at: "2026-10-01T00:00:00Z", flags: ["duplicate_of:e0"] },
        { id: "e2", title: null, state: "processing", show_id: SHOW, created_at: "2026-10-03T00:00:00Z", flags: [] },
      ],
      jobs: [
        { episode_id: "e2", step: "transcribe", status: "succeeded", created_at: "2026-10-03T01:00:00Z", lease_until: null },
        { episode_id: "e2", step: "cut", status: "running", created_at: "2026-10-03T02:00:00Z", lease_until: "2026-10-03T03:00:00Z" },
      ],
      posts: [
        { platform: "youtube", scheduled_for: "2026-10-06T01:00:00Z", show_id: SHOW },
        { platform: "instagram", scheduled_for: "2026-10-06T02:00:00Z", show_id: SHOW },
        { platform: "youtube", scheduled_for: "2026-10-06T03:00:00Z", show_id: SHOW },
      ],
    };
    const t = buildToday(rows, now, "Asia/Makassar");
    expect(t.forYou[0]).toMatchObject({ kind: "review", title: "What Is Time, Really?", ground: "#2A1D16", detail: "Human Time with GG · ready for review · looks like a recording you already have" });
    expect(t.inStudio[0]).toMatchObject({ name: "New Human Time with GG recording", stepLabel: "Cutting", stepIndex: 2, totalSteps: 11 });
    expect(t.week[2]).toEqual({ key: "2026-10-06", day: "Tue 6", items: "Human Time with GG on YouTube and Instagram" });
    expect(t.summary).toBe("1 episode is ready for you, 1 recording in the studio and 3 posts going out this week.");
    // The running cut job's lease ran out before now: it is stuck.
    expect(t.healthy).toBe(false);
    expect(t.healthNote).toBe("1 step stuck");
  });

  it("never skips or repeats a day across a clock change", () => {
    const t = buildToday(base, new Date("2027-03-27T23:30:00Z"), "Europe/London");
    expect(t.week.map((d) => d.key)).toEqual(["2027-03-27", "2027-03-28", "2027-03-29", "2027-03-30", "2027-03-31", "2027-04-01", "2027-04-02"]);
  });
});
