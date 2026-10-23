import { describe, expect, it } from "vitest";
import { buildPlan, pillarsOf, planWindow, postWindow, weeksAheadOf, zonedInstant, type PlanRows } from "./plan.build";

// A Friday, 10:00 in Makassar (02:00 UTC).
const now = new Date("2026-10-23T02:00:00Z");
const TZ = "Asia/Makassar";

const rows: PlanRows = {
  shows: [
    {
      id: "s1",
      slug: "human-time",
      name: "Human Time with GG",
      theme: { accent: "#CD9936" },
      slots: [
        { day: "tue", time: "09:00", tz: TZ },
        { day: "fri", time: "09:00", tz: TZ },
      ],
      compass: { pillars: ["Personal growth and time", "Quantum light science"] },
    },
  ],
  posts: [
    // Tuesday 27 October, 09:00 Makassar is 01:00 UTC.
    { scheduled_for: "2026-10-27T01:00:00Z", platform: "youtube", status: "scheduled", show_id: "s1" },
  ],
  ideas: [
    { id: "i1", show_id: "s1", pillar: "Quantum light science", body: "The waiting bit from episode four.", slot_at: "2026-10-30T01:00:00Z", state: "idea" },
    { id: "i2", show_id: "s1", pillar: "Personal growth and time", body: "No slot for this one yet.", slot_at: null, state: "idea" },
    { id: "i3", show_id: "s1", pillar: "Personal growth and time", body: "Changed my mind.", slot_at: "2026-11-03T01:00:00Z", state: "dropped" },
  ],
  anchors: [
    { name: "UK clocks go back", date: "2026-10-25", recurrence: "none" },
    { name: "Winter solstice", date: "2019-12-21", recurrence: "yearly" },
  ],
};

describe("weeksAheadOf", () => {
  it("takes one to eight weeks and falls back to four", () => {
    expect(weeksAheadOf("6")).toBe(6);
    expect(weeksAheadOf("1")).toBe(1);
    expect(weeksAheadOf("9")).toBe(4);
    expect(weeksAheadOf("0")).toBe(4);
    expect(weeksAheadOf("soon")).toBe(4);
    expect(weeksAheadOf(undefined)).toBe(4);
  });
});

describe("planWindow", () => {
  it("counts weeks from the Monday of the week we are in, and starts at now", () => {
    const w = planWindow(now, 3, TZ);
    expect(w.weekStarts).toEqual(["2026-10-19", "2026-10-26", "2026-11-02"]);
    expect(w.from).toBe("2026-10-23T02:00:00.000Z");
    expect(w.to).toBe("2026-11-09T00:00:00.000Z");
  });

  it("uses the time zone's own day, so late evening is not yesterday's week", () => {
    // 23:30 UTC on Sunday 25 October is already Monday 26th in Makassar.
    const w = planWindow(new Date("2026-10-25T23:30:00Z"), 1, TZ);
    expect(w.weekStarts).toEqual(["2026-10-26"]);
  });

  it("fetches posts a day either side", () => {
    const p = postWindow(planWindow(now, 1, TZ));
    expect(p.from).toBe("2026-10-22T02:00:00.000Z");
    expect(p.to).toBe("2026-10-27T00:00:00.000Z");
  });
});

describe("zonedInstant", () => {
  it("keeps a slot at its local time across a clocks change", () => {
    // London loses an hour of offset on 25 October 2026.
    expect(zonedInstant("2026-10-24", "09:00", "Europe/London").toISOString()).toBe("2026-10-24T08:00:00.000Z");
    expect(zonedInstant("2026-10-26", "09:00", "Europe/London").toISOString()).toBe("2026-10-26T09:00:00.000Z");
    expect(zonedInstant("2026-10-27", "09:00", TZ).toISOString()).toBe("2026-10-27T01:00:00.000Z");
    expect(zonedInstant("2026-10-27", "09:00", "UTC").toISOString()).toBe("2026-10-27T09:00:00.000Z");
  });
});

describe("pillarsOf", () => {
  it("is empty when no vision is written, rather than inventing one", () => {
    expect(pillarsOf(null)).toEqual([]);
    expect(pillarsOf({})).toEqual([]);
    expect(pillarsOf({ pillars: ["A", "", 7] })).toEqual(["A"]);
  });
});

describe("buildPlan", () => {
  const window = planWindow(now, 3, TZ);
  const plan = buildPlan(rows, window, now, TZ);
  const show = plan.shows[0]!;

  it("drops the slots that have already passed and keeps the ones ahead", () => {
    // This week: Tuesday 20th and Friday 23rd 09:00 are both behind 10:00 Friday.
    expect(show.weeks[0]!.slots).toHaveLength(0);
    expect(show.weeks[0]!.thisWeek).toBe(true);
    expect(show.weeks[1]!.slots.map((s) => `${s.dayLabel} ${s.time}`)).toEqual(["Tue 27 09:00", "Fri 30 09:00"]);
    expect(show.slotCount).toBe(4);
  });

  it("marks a slot a post is already heading for, and leaves the rest empty", () => {
    const tue = show.weeks[1]!.slots[0]!;
    expect(tue.fill).toEqual({ label: "YouTube", status: "scheduled", at: "2026-10-27T01:00:00Z" });
    expect(show.weeks[1]!.slots[1]!.fill).toBeNull();
  });

  it("hangs an idea on its slot and counts the gaps that are still questions", () => {
    const fri = show.weeks[1]!.slots[1]!;
    expect(fri.ideas.map((i) => i.body)).toEqual(["The waiting bit from episode four."]);
    // Of four slots: one filled, one answered by an idea, two still open.
    expect(show.weeks[1]!.empty).toBe(0);
    expect(show.weeks[2]!.empty).toBe(2);
    expect(show.empty).toBe(2);
    expect(plan.empty).toBe(2);
  });

  it("keeps an idea with no slot, and leaves a dropped one out", () => {
    expect(show.loose.map((i) => i.id)).toEqual(["i2"]);
    expect(show.weeks.flatMap((w) => w.slots).flatMap((s) => s.ideas).map((i) => i.id)).toEqual(["i1"]);
  });

  it("ties ideas to the pillars of the show's own compass", () => {
    expect(show.pillars).toEqual(["Personal growth and time", "Quantum light science"]);
    expect(show.pillarCounts).toEqual([
      { pillar: "Personal growth and time", ideas: 1 },
      { pillar: "Quantum light science", ideas: 1 },
    ]);
  });

  it("names the moments in time each week sits against", () => {
    expect(show.weeks[0]!.anchors).toEqual(["UK clocks go back"]);
    expect(show.weeks[1]!.anchors).toEqual([]);
    const then = new Date("2026-12-18T02:00:00Z");
    const december = buildPlan(rows, planWindow(then, 2, TZ), then, TZ);
    expect(december.shows[0]!.weeks.map((w) => w.anchors)).toEqual([[], ["Winter solstice"]]);
  });

  it("says a show has no rhythm rather than guessing one", () => {
    const bare = buildPlan(
      { ...rows, shows: [{ id: "s2", slug: "new", name: "New show", theme: null, slots: [], compass: null }], posts: [], ideas: [] },
      window,
      now,
      TZ,
    );
    expect(bare.shows[0]!.slotCount).toBe(0);
    expect(bare.shows[0]!.rhythm).toBe("No set rhythm yet");
    expect(bare.shows[0]!.pillars).toEqual([]);
    expect(bare.empty).toBe(0);
  });

  it("is empty, not invented, when there are no shows at all", () => {
    const none = buildPlan({ shows: [], posts: [], ideas: [], anchors: [] }, window, now, TZ);
    expect(none.shows).toEqual([]);
    expect(none.slotCount).toBe(0);
    expect(none.empty).toBe(0);
  });
});
