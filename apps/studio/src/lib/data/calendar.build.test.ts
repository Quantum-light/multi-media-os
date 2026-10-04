import { describe, expect, it } from "vitest";
import { buildCalendar, monthOf, monthWindow } from "./calendar.build";

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
