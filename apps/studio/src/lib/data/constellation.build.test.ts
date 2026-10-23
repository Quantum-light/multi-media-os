import { describe, expect, it } from "vitest";
import { buildConstellation, type ConstellationRows } from "./constellation.build";

const now = new Date("2026-10-23T09:00:00Z");

const empty: ConstellationRows = { themes: [], edges: [], anchors: [], holds: [], episodes: [], pieces: [] };

const rows: ConstellationRows = {
  themes: [
    { id: "t1", name: "Time", slug: "time" },
    { id: "t2", name: "Building in the open", slug: "building-in-the-open" },
  ],
  edges: [
    { from_kind: "episode", from_id: "e1", to_kind: "theme", to_id: "t1", kind: "same_theme", weight: 1 },
    { from_kind: "episode", from_id: "e2", to_kind: "theme", to_id: "t1", kind: "same_theme", weight: 3 },
    { from_kind: "theme", from_id: "t2", to_kind: "episode", to_id: "e2", kind: "part_of_arc", weight: 1 },
    { from_kind: "episode", from_id: "e2", to_kind: "episode", to_id: "e1", kind: "follows_on", weight: 1 },
  ],
  anchors: [
    { id: "a1", name: "UK clocks go back", date: "2026-10-25", recurrence: "none", scope: "global" },
    { id: "a2", name: "Winter solstice", date: "2019-12-21", recurrence: "yearly", scope: "global" },
    { id: "a3", name: "New year", date: "2019-01-01", recurrence: "yearly", scope: "global" },
    { id: "a4", name: "Launch day", date: "2026-03-01", recurrence: "none", scope: "workspace" },
  ],
  holds: [
    { id: "h1", anchor_id: "a2", piece_id: "p1", piece_kind: "piece", created_at: "2026-10-20T09:00:00Z" },
    { id: "h2", anchor_id: "a1", piece_id: "e1", piece_kind: "episode", created_at: "2026-10-21T09:00:00Z" },
  ],
  episodes: [
    { id: "e1", title: "What time really is" },
    { id: "e2", title: null },
  ],
  pieces: [{ id: "p1", kind: "short", platform: "youtube_shorts", episode_id: "e1" }],
};

describe("buildConstellation with nothing in it", () => {
  it("is a real, calm, empty screen", () => {
    const c = buildConstellation(empty, now, "UTC");
    expect(c).toMatchObject({ themes: [], otherLinks: [], moments: [], held: [], holdable: [] });
    expect(c.counts).toEqual({ themes: 0, links: 0, moments: 0, held: 0 });
  });

  it("still lists the moments in time when only those exist", () => {
    const c = buildConstellation({ ...empty, anchors: rows.anchors }, now, "UTC");
    expect(c.moments.map((m) => m.name)).toEqual(["UK clocks go back", "Winter solstice", "New year"]);
    expect(c.counts).toEqual({ themes: 0, links: 0, moments: 3, held: 0 });
  });
});

describe("buildConstellation themes", () => {
  it("puts the most connected theme first and names the other end of each link", () => {
    const c = buildConstellation(rows, now, "UTC");
    expect(c.themes.map((t) => [t.name, t.linkCount])).toEqual([["Time", 2], ["Building in the open", 1]]);
    expect(c.themes[0]!.links.map((l) => `${l.relation}: ${l.label}`)).toEqual([
      "same theme: An episode without a title yet",
      "same theme: What time really is",
    ]);
    expect(c.themes[1]!.links[0]).toMatchObject({ relation: "part of an arc with", label: "An episode without a title yet" });
  });

  it("keeps links with no theme at either end apart", () => {
    const c = buildConstellation(rows, now, "UTC");
    expect(c.otherLinks).toEqual([{ id: "e2-e1-0", from: "An episode without a title yet", to: "What time really is", relation: "follows on from" }]);
    expect(c.counts.links).toBe(4);
  });
});

describe("buildConstellation moments and holds", () => {
  it("moves a yearly moment to its next turn and drops one long past", () => {
    const c = buildConstellation(rows, now, "UTC");
    expect(c.moments.map((m) => [m.name, m.when, m.relative])).toEqual([
      ["UK clocks go back", "2026-10-25", "in 2 days"],
      ["Winter solstice", "2026-12-21", "in 2 months"],
      ["New year", "2027-01-01", "in 2 months"],
    ]);
    expect(c.moments[0]!.whenLabel).toBe("25 October 2026");
  });

  it("says what is held, for what, and when that falls", () => {
    const c = buildConstellation(rows, now, "UTC");
    expect(c.held.map((h) => [h.label, h.anchorName, h.when])).toEqual([
      ["What time really is", "UK clocks go back", "2026-10-25"],
      ["Short for YouTube Shorts", "Winter solstice", "2026-12-21"],
    ]);
    expect(c.held[1]!.source).toBe("What time really is");
    expect(c.moments[0]!.held.map((h) => h.id)).toEqual(["h2"]);
    expect(c.moments[2]!.held).toEqual([]);
    expect(c.counts.held).toBe(2);
  });

  it("keeps a moment that has passed when something is still held for it", () => {
    const past = { ...rows, holds: [{ id: "h3", anchor_id: "a4", piece_id: "e1", piece_kind: "episode", created_at: "2026-02-01T09:00:00Z" }] };
    const c = buildConstellation(past, now, "UTC");
    const launch = c.moments.find((m) => m.id === "a4")!;
    expect(launch).toMatchObject({ past: true, relative: "236 days ago" });
    expect(launch.held.map((h) => h.label)).toEqual(["What time really is"]);
    expect(c.counts.moments).toBe(3);
  });

  it("offers recordings and then the pieces made from them to hold", () => {
    const c = buildConstellation(rows, now, "UTC");
    expect(c.holdable).toEqual([
      { value: "episode:e1", label: "What time really is" },
      { value: "episode:e2", label: "An episode without a title yet" },
      { value: "piece:p1", label: "Short for YouTube Shorts — What time really is" },
    ]);
  });
});
