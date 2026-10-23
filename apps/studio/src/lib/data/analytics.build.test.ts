import { describe, expect, it } from "vitest";
import { buildAnalytics, evidenceFor, goalOf, personasOf, platformOfSource, progressOf, tallyEvidence, type KpiRow } from "./analytics.build";

const channels = [
  { platform: "youtube", handle: "@gg", status: "connected" },
  { platform: "instagram", handle: "@qls", status: "disconnected" },
];

describe("platformOfSource", () => {
  it("reads the platform an evidence source names", () => {
    expect(platformOfSource("youtube_analytics.returning_viewers")).toBe("youtube");
    expect(platformOfSource("youtube_shorts.views")).toBe("youtube_shorts");
    expect(platformOfSource("Instagram_Insights.reach")).toBe("instagram");
    expect(platformOfSource("spotify.listeners")).toBe("podcast");
    expect(platformOfSource("substack.subscribers")).toBe("newsletter");
  });

  it("names none for sources that were only ever going to be typed in", () => {
    expect(platformOfSource("manual")).toBeNull();
    expect(platformOfSource("by_hand.count")).toBeNull();
    expect(platformOfSource("")).toBeNull();
    expect(platformOfSource("a_feeling")).toBeNull();
  });
});

describe("progressOf", () => {
  it("caps at a hundred and never goes below nothing", () => {
    expect(progressOf(50, 200)).toBe(25);
    expect(progressOf(400, 200)).toBe(100);
    expect(progressOf(-10, 200)).toBe(0);
    expect(progressOf(0, 0)).toBe(100);
  });
});

describe("evidenceFor", () => {
  it("counts a number as measured only when that platform's analytics are connected", () => {
    expect(evidenceFor("youtube_analytics.views", ["youtube"], channels)).toMatchObject({ kind: "measured", platform: "youtube" });
  });

  it("calls a number typed in when the account posts but reports nothing", () => {
    const e = evidenceFor("youtube_analytics.views", [], channels);
    expect(e.kind).toBe("typed_in");
    expect(e.why).toContain("connected for posting");
  });

  it("calls a number typed in when the account is not connected, and when there is no account", () => {
    expect(evidenceFor("instagram.reach", [], channels).why).toContain("not connected");
    expect(evidenceFor("tiktok.views", [], channels).why).toContain("No TikTok account is set up yet");
  });

  it("calls a number typed in when its source names no platform", () => {
    expect(evidenceFor("manual", ["youtube"], channels)).toMatchObject({ kind: "typed_in", platform: null });
  });
});

describe("tallyEvidence", () => {
  const kpi = (kind: "measured" | "typed_in"): KpiRow => ({
    show: "A", objective: "O", name: "n", current: 1, target: 2, unit: "", progress: 50,
    evidence: { kind, source: "s", platform: null, why: "" } as KpiRow["evidence"],
  });

  it("says plainly how many numbers are still hand-typed", () => {
    expect(tallyEvidence([]).sentence).toBe("No goals are written yet, so there are no numbers to check.");
    expect(tallyEvidence([kpi("typed_in"), kpi("typed_in")])).toMatchObject({ measured: 0, typedIn: 2, sentence: "All 2 numbers are typed in by hand. None is measured yet." });
    expect(tallyEvidence([kpi("measured"), kpi("typed_in")]).sentence).toBe("1 of 2 numbers are measured. 1 are still typed in by hand.");
    expect(tallyEvidence([kpi("measured")]).sentence).toBe("All 1 numbers are read from connected analytics.");
  });
});

describe("goalOf", () => {
  it("takes the main goal out of a stored compass and drops what it cannot read", () => {
    const goal = goalOf({
      mainGoal: {
        statement: "Ten thousand people who come back",
        by: "2027-06-01",
        objectives: [
          { title: "Be found", kpis: [{ name: "Views", current: 0, target: 100, unit: "", evidenceSource: "youtube_analytics.views" }] },
          { title: "No kpis", kpis: [] },
          { title: "Bad kpi", kpis: [{ name: "Views", current: "lots", target: 100 }] },
          { kpis: [{ name: "x", current: 1, target: 1 }] },
        ],
      },
    });
    expect(goal?.statement).toBe("Ten thousand people who come back");
    expect(goal?.objectives).toHaveLength(1);
    expect(goal?.objectives[0]!.kpis[0]).toMatchObject({ unit: "", evidenceSource: "youtube_analytics.views" });
  });

  it("is null when nothing usable is stored", () => {
    expect(goalOf(null)).toBeNull();
    expect(goalOf({})).toBeNull();
    expect(goalOf("nonsense")).toBeNull();
  });
});

describe("personasOf", () => {
  it("reads named personas with their evidence, and keeps at most three", () => {
    const rows = personasOf({
      personas: [
        { name: "Maya", description: "Builds in public", evidence: [{ kind: "comment", note: "asked how to start" }, { note: "DM" }, { kind: "x" }] },
        { name: "No description" },
        { name: "Sam", description: "Watches on the train", evidence: [] },
        { name: "Three", description: "d" },
        { name: "Four", description: "d" },
      ],
    });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ name: "Maya", description: "Builds in public", evidence: ["comment: asked how to start", "DM"] });
  });

  it("is empty when no kit or no personas are written", () => {
    expect(personasOf(null)).toEqual([]);
    expect(personasOf({ personas: "nonsense" })).toEqual([]);
  });
});

describe("buildAnalytics", () => {
  const rows = {
    shows: [
      { id: "s1", brand_id: "b1", slug: "human-time", name: "Human Time with GG", compass: { mainGoal: { statement: "Reach the people who stay", by: "2027-01-01", objectives: [{ title: "Be found", kpis: [{ name: "Views", current: 0, target: 1000, unit: "", evidenceSource: "youtube_analytics.views" }, { name: "Mood", current: 2, target: 4, unit: "/5", evidenceSource: "manual" }] }] } } },
      { id: "s2", brand_id: "b1", slug: "no-vision", name: "No Vision Yet", compass: null },
    ],
    brands: [{ id: "b1", name: "Quantum Light Science", brand_kit: { personas: [{ name: "Maya", description: "Builds in public", evidence: [] }] } }],
    channels,
    posts: [],
    measuringPlatforms: [],
  };

  it("shows every KPI with where its number comes from, and no goals for a show without one", () => {
    const data = buildAnalytics(rows);
    expect(data.goals).toHaveLength(1);
    expect(data.goals[0]).toMatchObject({ slug: "human-time", progress: 25 });
    expect(data.goals[0]!.kpis.map((k) => k.evidence.kind)).toEqual(["typed_in", "typed_in"]);
    expect(data.tally).toMatchObject({ total: 2, measured: 0, typedIn: 2 });
  });

  it("lists each distinct evidence source once with the account behind it", () => {
    const data = buildAnalytics(rows);
    expect(data.sources).toEqual([
      { source: "manual", platform: null, channel: "No platform named", measured: false },
      { source: "youtube_analytics.views", platform: "youtube", channel: "@gg", measured: false },
    ]);
  });

  it("gives every show its brand's personas, and marks who is watching as unknown", () => {
    const data = buildAnalytics(rows);
    expect(data.audience).toHaveLength(2);
    expect(data.audience[1]).toMatchObject({ name: "No Vision Yet", brand: "Quantum Light Science", watching: "unknown" });
    expect(data.audience[0]!.personas[0]!.name).toBe("Maya");
  });

  it("has nothing published when there are no posts, and turns measured on once analytics report", () => {
    expect(buildAnalytics(rows).published).toEqual([]);
    const live = buildAnalytics({ ...rows, measuringPlatforms: ["youtube"], posts: [{ platform: "youtube", status: "published", live_url: "https://youtu.be/a", scheduled_for: "2026-10-01T09:00:00Z", show_id: "s1" }] });
    expect(live.tally).toMatchObject({ measured: 1, typedIn: 1 });
    expect(live.published[0]).toMatchObject({ show: "Human Time with GG", platform: "YouTube", liveUrl: "https://youtu.be/a" });
  });
});
