import { describe, expect, it } from "vitest";
import { buildShows, rhythmOf } from "./shows.build";

describe("rhythmOf", () => {
  it("reads posting slots as a sentence", () => {
    expect(rhythmOf([{ tz: "Asia/Makassar", day: "tue", time: "09:00" }, { tz: "Asia/Makassar", day: "fri", time: "09:00" }])).toBe("Tue and Fri at 09:00 · Makassar time");
    expect(rhythmOf([{ tz: "Europe/London", day: "mon", time: "08:00" }, { tz: "Europe/London", day: "thu", time: "18:30" }])).toBe("Mon 08:00 and Thu 18:30 · London time");
    expect(rhythmOf([])).toBe("No set rhythm yet");
    expect(rhythmOf("nonsense")).toBe("No set rhythm yet");
    expect(rhythmOf([{ day: 1 }])).toBe("No set rhythm yet");
  });
});

describe("buildShows", () => {
  const rows = {
    brands: [{ id: "b1", slug: "qls", name: "Quantum Light Science", brand_kit: { story: "Science for everyday people.", styleWords: ["calm", 3], fonts: { display: { family: "Cinzel" }, base: { family: "Satoshi" } } } }],
    shows: [
      { id: "s1", brand_id: "b1", slug: "a", name: "Show A", kind: "video", theme: { ground: "#2A1D16", accent: "#CD9936", ink: "#F2E6C8" }, slots: [], approval_mode: "review_all", compass: {} },
      { id: "s2", brand_id: "b1", slug: "b", name: "Show B", kind: "podcast", theme: { ground: "black" }, slots: [], approval_mode: "hands_off", compass: null },
    ],
    channels: [
      { id: "c1", platform: "instagram", handle: "@one", status: "connected" },
      { id: "c2", platform: "threads", handle: "@two", status: "disconnected" },
    ],
    links: [
      { show_id: "s1", channel_id: "c1", carries: ["reels", "carousels"] },
      { show_id: "s2", channel_id: "c1", carries: ["reels"] },
      { show_id: "s1", channel_id: "missing", carries: [] },
    ],
  };

  it("groups shows under brands with readable details", () => {
    const { brands } = buildShows(rows);
    expect(brands[0]).toMatchObject({ name: "Quantum Light Science", styleWords: ["calm"], fonts: "Cinzel and Satoshi" });
    expect(brands[0]!.shows[0]).toMatchObject({ kind: "Video show", approval: "You approve everything", hasVision: true, colours: { ground: "#2A1D16" } });
    expect(brands[0]!.shows[0]!.channels).toEqual([{ label: "Instagram @one", carries: "reels and carousels" }]);
    expect(brands[0]!.shows[1]).toMatchObject({ kind: "Podcast", hasVision: false, colours: null });
  });

  it("marks channels shared by several shows", () => {
    const { channels } = buildShows(rows);
    expect(channels[0]).toEqual({ id: "c1", label: "Instagram @one", connected: true, shows: ["Show A", "Show B"], shared: true });
    expect(channels[1]).toMatchObject({ connected: false, shows: [], shared: false });
  });
});
