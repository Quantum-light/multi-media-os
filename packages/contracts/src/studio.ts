import { z } from "zod";
import { HexColour } from "./brand";
import { Platform, ShowKind } from "./content";
import { Slug } from "./style";

/** What a person can set up themselves: brands, shows, channels. No developer needed. */

export const BrandSettings = z.object({
  name: z.string().min(1, "Give the brand a name").max(80),
  slug: Slug,
});
export type BrandSettings = z.infer<typeof BrandSettings>;

export const Day = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
export type Day = z.infer<typeof Day>;

/** A posting slot in the show's own time zone, so a tour never shifts the schedule. */
export const Slot = z.object({
  day: Day,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour time like 09:00"),
  tz: z.string().min(1, "Needs a time zone"),
});
export type Slot = z.infer<typeof Slot>;

export const Theme = z.object({
  ground: HexColour,
  accent: HexColour,
  ink: HexColour,
});
export type Theme = z.infer<typeof Theme>;

export const ApprovalMode = z.enum(["review_all", "auto_high_score", "hands_off"]);
export type ApprovalMode = z.infer<typeof ApprovalMode>;

export const ShowSettings = z.object({
  brandSlug: Slug,
  name: z.string().min(1, "Give the show a name").max(80),
  slug: Slug,
  kind: ShowKind,
  approvalMode: ApprovalMode,
  theme: Theme,
  slots: z.array(Slot).max(14).default([]),
  /** Channel ids this show posts to. Empty is fine: a show can exist before its channels. */
  channelIds: z.array(z.string().uuid()).max(20).default([]),
});
export type ShowSettings = z.infer<typeof ShowSettings>;

export const ChannelSettings = z.object({
  platform: Platform,
  handle: z.string().min(1, "Needs the handle or page name").max(120),
  status: z.enum(["connected", "disconnected"]),
});
export type ChannelSettings = z.infer<typeof ChannelSettings>;
