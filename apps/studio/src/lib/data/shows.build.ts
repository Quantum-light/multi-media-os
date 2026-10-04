import { listJoin, platformName } from "@/lib/format";

export type ShowCard = {
  slug: string;
  name: string;
  kind: string;
  colours: { ground: string; accent: string; ink: string } | null;
  rhythm: string;
  approval: string;
  hasVision: boolean;
  channels: { label: string; carries: string }[];
};
export type BrandBlock = { slug: string; name: string; story: string; styleWords: string[]; fonts: string; shows: ShowCard[] };
export type ChannelRow = { id: string; label: string; connected: boolean; shows: string[]; shared: boolean };
export type ShowsData = { brands: BrandBlock[]; channels: ChannelRow[] };

export type ShowsRows = {
  brands: { id: string; slug: string; name: string; brand_kit: unknown }[];
  shows: { id: string; brand_id: string; slug: string; name: string; kind: string; theme: unknown; slots: unknown; approval_mode: string; compass: unknown }[];
  channels: { id: string; platform: string; handle: string; status: string }[];
  links: { show_id: string; channel_id: string; carries: string[] }[];
};

const KIND: Record<string, string> = { podcast: "Podcast", video: "Video show", both: "Podcast and video" };
const APPROVAL: Record<string, string> = {
  review_all: "You approve everything",
  auto_high_score: "Strong pieces go out on their own",
  hands_off: "Hands off",
};
const DAYS: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

/** Brands with their shows, and every channel with the shows it carries. Pure and tested. */
export function buildShows(rows: ShowsRows): ShowsData {
  const channelById = new Map(rows.channels.map((c) => [c.id, c]));
  const showById = new Map(rows.shows.map((s) => [s.id, s]));
  const channelLabel = (c: { platform: string; handle: string }) => `${platformName(c.platform)} ${c.handle}`;

  const brands = rows.brands.map((b) => {
    const kit = asRecord(b.brand_kit);
    return {
      slug: b.slug,
      name: b.name,
      story: typeof kit["story"] === "string" ? kit["story"] : "",
      styleWords: Array.isArray(kit["styleWords"]) ? kit["styleWords"].filter((w): w is string => typeof w === "string") : [],
      fonts: fontsOf(kit["fonts"]),
      shows: rows.shows
        .filter((s) => s.brand_id === b.id)
        .map((s) => ({
          slug: s.slug,
          name: s.name,
          kind: KIND[s.kind] ?? s.kind,
          colours: coloursOf(s.theme),
          rhythm: rhythmOf(s.slots),
          approval: APPROVAL[s.approval_mode] ?? s.approval_mode,
          hasVision: s.compass !== null,
          channels: rows.links
            .filter((l) => l.show_id === s.id)
            .flatMap((l) => {
              const c = channelById.get(l.channel_id);
              return c ? [{ label: channelLabel(c), carries: listJoin(l.carries) }] : [];
            }),
        })),
    };
  });

  const channels = rows.channels.map((c) => {
    const shows = rows.links.filter((l) => l.channel_id === c.id).flatMap((l) => showById.get(l.show_id)?.name ?? []);
    return { id: c.id, label: channelLabel(c), connected: c.status === "connected", shows, shared: shows.length > 1 };
  });

  return { brands, channels };
}

/** "Tue and Fri at 09:00 · Makassar time"; "No set rhythm" when there are no slots. */
export function rhythmOf(slots: unknown): string {
  if (!Array.isArray(slots) || slots.length === 0) return "No set rhythm yet";
  const valid = slots.map(asRecord).filter((s) => typeof s["day"] === "string" && typeof s["time"] === "string");
  if (valid.length === 0) return "No set rhythm yet";
  const times = new Set(valid.map((s) => s["time"] as string));
  const zones = new Set(valid.map((s) => (typeof s["tz"] === "string" ? s["tz"] : "UTC")));
  const days = listJoin(valid.map((s) => DAYS[s["day"] as string] ?? (s["day"] as string)));
  const when = times.size === 1 ? `${days} at ${[...times][0]}` : listJoin(valid.map((s) => `${DAYS[s["day"] as string] ?? s["day"]} ${s["time"]}`));
  const zone = zones.size === 1 ? ` · ${cityOf([...zones][0]!)} time` : "";
  return `${when}${zone}`;
}

function cityOf(tz: string): string {
  return (tz.split("/").pop() ?? tz).replaceAll("_", " ");
}

function coloursOf(theme: unknown): ShowCard["colours"] {
  const t = asRecord(theme);
  const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null);
  const ground = hex(t["ground"]);
  const accent = hex(t["accent"]);
  const ink = hex(t["ink"]);
  return ground && accent && ink ? { ground, accent, ink } : null;
}

function fontsOf(fonts: unknown): string {
  const f = asRecord(fonts);
  const family = (v: unknown) => {
    const r = asRecord(v);
    return typeof r["family"] === "string" ? r["family"] : null;
  };
  return listJoin([family(f["display"]), family(f["base"])].filter((x): x is string => x !== null));
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
