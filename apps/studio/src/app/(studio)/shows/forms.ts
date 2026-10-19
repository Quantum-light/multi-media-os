import type { ShowSetup } from "@/lib/data";
import { slugify } from "@/lib/save";

type Kind = "podcast" | "video" | "both";
type Approval = "review_all" | "auto_high_score" | "hands_off";
type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type SlotDraft = { day: Day; time: string; tz: string };

export type ShowFormDraft = {
  brandSlug: string;
  name: string;
  slug: string;
  slugEdited: boolean;
  kind: Kind;
  approvalMode: Approval;
  ground: string;
  accent: string;
  ink: string;
  slots: SlotDraft[];
  channelIds: string[];
};

export type BrandFormDraft = { name: string; slug: string; slugEdited: boolean };
export type ChannelFormDraft = { platform: string; handle: string; status: "connected" | "disconnected" };

const STUDIO_THEME = { ground: "#F1F2F4", accent: "#C9A24A", ink: "#2E3442" };

export function emptyShowForm(brandSlug: string, timeZone: string): ShowFormDraft {
  return {
    brandSlug,
    name: "",
    slug: "",
    slugEdited: false,
    kind: "video",
    approvalMode: "review_all",
    ...STUDIO_THEME,
    slots: [{ day: "tue", time: "09:00", tz: timeZone }],
    channelIds: [],
  };
}

export function fromShowSetup(show: ShowSetup, timeZone: string): ShowFormDraft {
  return {
    brandSlug: show.brandSlug,
    name: show.name,
    slug: show.slug,
    slugEdited: true,
    kind: asKind(show.kind),
    approvalMode: asApproval(show.approvalMode),
    ground: show.theme?.ground ?? STUDIO_THEME.ground,
    accent: show.theme?.accent ?? STUDIO_THEME.accent,
    ink: show.theme?.ink ?? STUDIO_THEME.ink,
    slots: show.slots.length > 0 ? show.slots.map((s) => ({ ...s })) : [{ day: "tue", time: "09:00", tz: timeZone }],
    channelIds: [...show.channelIds],
  };
}

/** Naming a new show names its slug too, until someone sets the slug themselves. */
export function renameShow(draft: ShowFormDraft, name: string): ShowFormDraft {
  return { ...draft, name, slug: draft.slugEdited ? draft.slug : slugify(name) };
}

export function reslugShow(draft: ShowFormDraft, slug: string): ShowFormDraft {
  return { ...draft, slug, slugEdited: true };
}

export function renameBrand(draft: BrandFormDraft, name: string): BrandFormDraft {
  return { ...draft, name, slug: draft.slugEdited ? draft.slug : slugify(name) };
}

export function toShowSettings(draft: ShowFormDraft): unknown {
  return {
    brandSlug: draft.brandSlug,
    name: draft.name.trim(),
    slug: draft.slug.trim(),
    kind: draft.kind,
    approvalMode: draft.approvalMode,
    theme: { ground: colour(draft.ground), accent: colour(draft.accent), ink: colour(draft.ink) },
    slots: draft.slots.filter((slot) => slot.time.trim() !== "").map((slot) => ({ day: slot.day, time: slot.time.trim(), tz: slot.tz.trim() })),
    channelIds: [...new Set(draft.channelIds)],
  };
}

export function toBrandSettings(draft: BrandFormDraft): unknown {
  return { name: draft.name.trim(), slug: draft.slug.trim() };
}

export function toChannelSettings(draft: ChannelFormDraft): unknown {
  return { platform: draft.platform, handle: draft.handle.trim(), status: draft.status };
}

/** "Tue 09:00 and Fri 09:00", the way the show page says it back. */
export function describeSlots(slots: SlotDraft[]): string {
  const real = slots.filter((slot) => slot.time.trim() !== "");
  if (real.length === 0) return "No set rhythm yet";
  const labels: Record<Day, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
  return real.map((slot) => `${labels[slot.day]} ${slot.time}`).join(" and ");
}

function asKind(value: string): Kind {
  return value === "podcast" || value === "both" ? value : "video";
}

function asApproval(value: string): Approval {
  return value === "auto_high_score" || value === "hands_off" ? value : "review_all";
}

function colour(value: string): string {
  const text = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(text) ? text.toUpperCase() : text;
}
