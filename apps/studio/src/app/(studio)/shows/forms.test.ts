import { describe, expect, it } from "vitest";
import { ShowSettings } from "@mmos/contracts";
import type { ShowSetup } from "@/lib/data";
import {
  describeSlots,
  emptyShowForm,
  fromShowSetup,
  renameBrand,
  renameShow,
  reslugShow,
  toBrandSettings,
  toChannelSettings,
  toShowSettings,
} from "./forms";

const setup: ShowSetup = {
  id: "00000000-0000-0000-0000-00000000000a",
  brandSlug: "quantum-light-science",
  slug: "human-time",
  name: "Human Time with GG",
  kind: "both",
  approvalMode: "review_all",
  theme: { ground: "#F1F2F4", accent: "#C9A24A", ink: "#2E3442" },
  slots: [{ day: "tue", time: "09:00", tz: "Asia/Makassar" }],
  channelIds: ["5f5d6c9a-0000-4000-8000-000000000001"],
};

describe("the show form", () => {
  it("survives a round trip and still satisfies the contract", () => {
    const parsed = ShowSettings.parse(toShowSettings(fromShowSetup(setup, "UTC")));
    expect(parsed.slug).toBe("human-time");
    expect(parsed.slots).toEqual(setup.slots);
    expect(parsed.channelIds).toEqual(setup.channelIds);
  });

  it("starts a new show on the Studio's palette and the workspace's own time zone", () => {
    const draft = emptyShowForm("attachai", "Asia/Makassar");
    expect(draft.accent).toBe("#C9A24A");
    expect(draft.slots[0]?.tz).toBe("Asia/Makassar");
    expect(draft.brandSlug).toBe("attachai");
  });

  it("falls back to the Studio palette when a stored theme is unreadable", () => {
    const draft = fromShowSetup({ ...setup, theme: null }, "UTC");
    expect(draft.ground).toBe("#F1F2F4");
  });

  it("offers one slot to fill in when a show has no rhythm yet", () => {
    expect(fromShowSetup({ ...setup, slots: [] }, "UTC").slots).toHaveLength(1);
  });

  it("names the slug from the name, until someone sets the slug by hand", () => {
    const named = renameShow(emptyShowForm("b", "UTC"), "Tech Prophecy Time");
    expect(named.slug).toBe("tech-prophecy-time");
    const chosen = reslugShow(named, "prophecy");
    expect(renameShow(chosen, "Something else").slug).toBe("prophecy");
  });

  it("never renames the slug of a show that already exists", () => {
    expect(renameShow(fromShowSetup(setup, "UTC"), "A new name").slug).toBe("human-time");
  });

  it("drops a half-added slot and never connects a channel twice", () => {
    const draft = fromShowSetup(setup, "UTC");
    const messy = {
      ...draft,
      slots: [...draft.slots, { day: "fri" as const, time: "  ", tz: "UTC" }],
      channelIds: [...draft.channelIds, ...draft.channelIds],
    };
    const parsed = ShowSettings.parse(toShowSettings(messy));
    expect(parsed.slots).toHaveLength(1);
    expect(parsed.channelIds).toHaveLength(1);
  });

  it("stores a theme colour one way only", () => {
    const draft = { ...fromShowSetup(setup, "UTC"), accent: " #c9a24a " };
    const parsed = ShowSettings.parse(toShowSettings(draft));
    expect(parsed.theme.accent).toBe("#C9A24A");
  });

  it("falls back to a video show when the stored kind is unknown", () => {
    expect(fromShowSetup({ ...setup, kind: "livestream", approvalMode: "whatever" }, "UTC")).toMatchObject({
      kind: "video",
      approvalMode: "review_all",
    });
  });
});

describe("describeSlots", () => {
  it("says the rhythm back the way the page does", () => {
    expect(describeSlots([{ day: "tue", time: "09:00", tz: "UTC" }, { day: "fri", time: "09:00", tz: "UTC" }])).toBe("Tue 09:00 and Fri 09:00");
  });

  it("says so plainly when there is no rhythm", () => {
    expect(describeSlots([{ day: "tue", time: " ", tz: "UTC" }])).toBe("No set rhythm yet");
  });
});

describe("the brand and channel forms", () => {
  it("names a brand's slug from its name", () => {
    expect(renameBrand({ name: "", slug: "", slugEdited: false }, "Attachai").slug).toBe("attachai");
    expect(toBrandSettings({ name: " Attachai ", slug: "attachai", slugEdited: true })).toEqual({ name: "Attachai", slug: "attachai" });
  });

  it("trims a handle, because a pasted one often carries a space", () => {
    expect(toChannelSettings({ platform: "youtube", handle: " @humantime ", status: "connected" })).toEqual({
      platform: "youtube",
      handle: "@humantime",
      status: "connected",
    });
  });
});
