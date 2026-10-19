import { describe, expect, it } from "vitest";
import { BrandSettings, ChannelSettings, ShowSettings, Slot } from "./studio";

const show = {
  brandSlug: "quantum-light-science",
  name: "Human Time with GG",
  slug: "human-time",
  kind: "both" as const,
  approvalMode: "review_all" as const,
  theme: { ground: "#F1F2F4", accent: "#C9A24A", ink: "#2E3442" },
  slots: [{ day: "tue" as const, time: "09:00", tz: "Asia/Makassar" }],
  channelIds: ["5f5d6c9a-0000-4000-8000-000000000001"],
};

describe("Slot", () => {
  it("accepts a 24-hour time", () => {
    expect(Slot.safeParse({ day: "mon", time: "23:59", tz: "UTC" }).success).toBe(true);
    expect(Slot.safeParse({ day: "mon", time: "00:00", tz: "UTC" }).success).toBe(true);
  });

  it("refuses times that are not real", () => {
    for (const time of ["24:00", "9:00", "09:60", "nine", ""]) {
      expect(Slot.safeParse({ day: "mon", time, tz: "UTC" }).success, time).toBe(false);
    }
  });

  it("insists on a time zone, because a slot without one drifts", () => {
    expect(Slot.safeParse({ day: "mon", time: "09:00", tz: "" }).success).toBe(false);
  });
});

describe("ShowSettings", () => {
  it("accepts a show a person would actually set up", () => {
    expect(ShowSettings.safeParse(show).success).toBe(true);
  });

  it("lets a show exist before it has any channels or rhythm", () => {
    const { slots, channelIds, ...rest } = show;
    void slots;
    void channelIds;
    const parsed = ShowSettings.parse(rest);
    expect(parsed.slots).toEqual([]);
    expect(parsed.channelIds).toEqual([]);
  });

  it("refuses a theme colour that is not #RRGGBB", () => {
    expect(ShowSettings.safeParse({ ...show, theme: { ...show.theme, accent: "gold" } }).success).toBe(false);
  });

  it("refuses an unknown kind or approval mode", () => {
    expect(ShowSettings.safeParse({ ...show, kind: "livestream" }).success).toBe(false);
    expect(ShowSettings.safeParse({ ...show, approvalMode: "whatever" }).success).toBe(false);
  });

  it("refuses a slug a person typed as a sentence", () => {
    expect(ShowSettings.safeParse({ ...show, slug: "Human Time" }).success).toBe(false);
  });
});

describe("BrandSettings and ChannelSettings", () => {
  it("accept the least a person can give", () => {
    expect(BrandSettings.safeParse({ name: "Attachai", slug: "attachai" }).success).toBe(true);
    expect(ChannelSettings.safeParse({ platform: "youtube", handle: "@humantime", status: "connected" }).success).toBe(true);
  });

  it("refuse a platform the system cannot post to", () => {
    expect(ChannelSettings.safeParse({ platform: "myspace", handle: "@gg", status: "connected" }).success).toBe(false);
  });
});
