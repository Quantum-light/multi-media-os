import { describe, expect, it } from "vitest";
import { buildCalendar, calendarHref, monthOf, monthWindow, parseLayer, selectionFrom } from "./calendar.build";

const now = new Date("2026-10-04T01:00:00Z");

describe("monthOf", () => {
  it("accepts YYYY-MM and falls back to this month in the time zone", () => {
    expect(monthOf("2027-03", now, "UTC")).toBe("2027-03");
    expect(monthOf("2027-13", now, "UTC")).toBe("2026-10");
    expect(monthOf(undefined, new Date("2026-09-30T20:00:00Z"), "Asia/Makassar")).toBe("2026-10");
  });
  it("fetches a day either side of the month", () => {
    expect(monthWindow("2026-10")).toEqual({ from: "2026-09-30T00:00:00.000Z", to: "2026-11-02T00:00:00.000Z" });
  });
});

describe("buildCalendar", () => {
  const rows = {
    shows: [{ id: "s1", name: "Human Time with GG", theme: { accent: "#CD9936" } }],
    posts: [
      // 23:30 UTC on 5 Oct is 07:30 on 6 Oct in Bali.
      { scheduled_for: "2026-10-05T23:30:00Z", platform: "youtube", status: "scheduled", show_id: "s1" },
      { scheduled_for: "2026-10-05T22:00:00Z", platform: "instagram", status: "waiting_review", show_id: "s1" },
    ],
    anchors: [
      { name: "UK clocks go back", date: "2026-10-25", recurrence: "none" },
      { name: "Halloween", date: "2019-10-31", recurrence: "yearly" },
      { name: "Winter solstice", date: "2026-12-21", recurrence: "yearly" },
    ],
  };

  it("lays October 2026 out Monday-first with whole weeks", () => {
    const c = buildCalendar(rows, "2026-10", now, "Asia/Makassar");
    expect(c.monthLabel).toBe("October 2026");
    expect(c.prev).toBe("2026-09");
    expect(c.next).toBe("2026-11");
    expect(c.weeks).toHaveLength(5);
    expect(c.weeks[0]![0]).toMatchObject({ key: "2026-09-28", inMonth: false });
    expect(c.weeks[0]![3]).toMatchObject({ key: "2026-10-01", day: 1, inMonth: true });
    expect(c.weeks.flat().find((d) => d.isToday)?.key).toBe("2026-10-04");
  });

  it("places posts on their local day, in time order", () => {
    const c = buildCalendar(rows, "2026-10", now, "Asia/Makassar");
    const day = c.weeks.flat().find((d) => d.key === "2026-10-06")!;
    expect(day.posts.map((p) => `${p.time} ${p.platform}`)).toEqual(["06:00 Instagram", "07:30 YouTube"]);
    expect(day.posts[0]!.accent).toBe("#CD9936");
    expect(c.postCount).toBe(2);
  });

  it("repeats yearly anchors and keeps one-off ones on their date", () => {
    const c = buildCalendar(rows, "2026-10", now, "UTC");
    expect(c.anchorsThisMonth).toEqual([{ name: "UK clocks go back", key: "2026-10-25" }, { name: "Halloween", key: "2026-10-31" }]);
    const dec = buildCalendar(rows, "2027-12", now, "UTC");
    expect(dec.anchorsThisMonth).toEqual([{ name: "Winter solstice", key: "2027-12-21" }]);
  });

  it("handles a year boundary", () => {
    const c = buildCalendar(rows, "2027-01", now, "UTC");
    expect(c.prev).toBe("2026-12");
    expect(c.weeks[0]![0]!.key).toBe("2026-12-28");
  });
});

describe("layers in the URL", () => {
  it("reads one parameter, comma separated or repeated, and drops the empties", () => {
    expect(parseLayer("human-time, tech-prophecy")).toEqual(["human-time", "tech-prophecy"]);
    expect(parseLayer(["youtube", "youtube,instagram", " "])).toEqual(["youtube", "instagram"]);
    expect(parseLayer(undefined)).toEqual([]);
  });

  it("writes them back into an address", () => {
    expect(selectionFrom({ show: "human-time", platform: ["youtube", "instagram"] })).toEqual({ shows: ["human-time"], platforms: ["youtube", "instagram"] });
    expect(calendarHref("2026-10", { shows: [], platforms: [] })).toBe("/calendar?month=2026-10");
    expect(calendarHref("2026-10", { shows: ["human-time"], platforms: ["youtube", "instagram"] })).toBe("/calendar?month=2026-10&show=human-time&platform=youtube%2Cinstagram");
  });
});

describe("buildCalendar with layers", () => {
  const layered = {
    shows: [
      { id: "s1", name: "Human Time with GG", slug: "human-time", theme: { accent: "#CD9936" } },
      { id: "s2", name: "Tech Prophecy Time", slug: "tech-prophecy", theme: {} },
    ],
    posts: [
      { scheduled_for: "2026-10-06T09:00:00Z", platform: "youtube", status: "scheduled", show_id: "s1", episode_id: "e1" },
      { scheduled_for: "2026-10-06T11:00:00Z", platform: "instagram", status: "scheduled", show_id: "s1", episode_id: "e1" },
      { scheduled_for: "2026-10-07T09:00:00Z", platform: "youtube", status: "scheduled", show_id: "s2", episode_id: "e2" },
    ],
    anchors: [],
    themes: [{ id: "t1", name: "Time" }, { id: "t2", name: "Building in the open" }],
    edges: [
      { from_kind: "episode", from_id: "e1", to_kind: "theme", to_id: "t1" },
      { from_kind: "episode", from_id: "e2", to_kind: "theme", to_id: "t2" },
      { from_kind: "theme", from_id: "t2", to_kind: "episode", to_id: "e1" },
    ],
  };

  it("shows everything when no layer is chosen, and counts each one", () => {
    const c = buildCalendar(layered, "2026-10", now, "UTC");
    expect(c.postCount).toBe(3);
    expect(c.hiddenCount).toBe(0);
    expect(c.layers.on).toBe(false);
    expect(c.layers.shows.map((s) => [s.value, s.count, s.on])).toEqual([["human-time", 2, false], ["tech-prophecy", 1, false]]);
    expect(c.layers.platforms.map((p) => [p.value, p.label, p.count])).toEqual([["instagram", "Instagram", 1], ["youtube", "YouTube", 2]]);
    expect(c.layers.shows[0]!.href).toBe("/calendar?month=2026-10&show=human-time");
  });

  it("hides the shows and platforms not chosen, and says how many it hid", () => {
    const c = buildCalendar(layered, "2026-10", now, "UTC", { shows: ["human-time"], platforms: ["youtube"] });
    expect(c.postCount).toBe(1);
    expect(c.hiddenCount).toBe(2);
    expect(c.layers.on).toBe(true);
    expect(c.weeks.flat().find((d) => d.key === "2026-10-06")!.posts.map((p) => p.platform)).toEqual(["YouTube"]);
    expect(c.weeks.flat().find((d) => d.key === "2026-10-07")!.posts).toEqual([]);
    expect(c.layers.clearHref).toBe("/calendar?month=2026-10");
    expect(c.layers.shows[0]!.href).toBe("/calendar?month=2026-10&platform=youtube");
    expect(c.layers.platforms.find((p) => p.value === "instagram")!.href).toBe("/calendar?month=2026-10&show=human-time&platform=youtube%2Cinstagram");
  });

  it("keeps the layers when stepping through the months", () => {
    const c = buildCalendar(layered, "2026-10", now, "UTC", { shows: ["tech-prophecy"], platforms: [] });
    expect(c.prevHref).toBe("/calendar?month=2026-09&show=tech-prophecy");
    expect(c.nextHref).toBe("/calendar?month=2026-11&show=tech-prophecy");
    expect(c.thisHref).toBe("/calendar?month=2026-10&show=tech-prophecy");
  });

  it("carries the themes behind each post, most used first", () => {
    const c = buildCalendar(layered, "2026-10", now, "UTC");
    const sixth = c.weeks.flat().find((d) => d.key === "2026-10-06")!;
    expect(sixth.themes).toEqual(["Time", "Building in the open"]);
    expect(sixth.posts[0]!.themes).toEqual(["Time", "Building in the open"]);
    expect(c.themesThisMonth).toEqual([{ name: "Building in the open", count: 3 }, { name: "Time", count: 2 }]);
  });

  it("shows a platform the address asks for even when nothing is on it, and nothing else", () => {
    const c = buildCalendar(layered, "2026-10", now, "UTC", { shows: [], platforms: ["tiktok"] });
    expect(c.postCount).toBe(0);
    expect(c.themesThisMonth).toEqual([]);
    expect(c.layers.platforms.map((p) => p.value)).toEqual(["instagram", "tiktok", "youtube"]);
    expect(c.layers.platforms.find((p) => p.value === "tiktok")).toMatchObject({ on: true, count: 0 });
  });
});
