import { listJoin, platformName } from "@/lib/format";

/**
 * Where a KPI's number actually comes from.
 * measured: an analytics source is connected and reports it.
 * typed_in: nobody is reporting it, so the number on screen was typed by hand.
 */
export type Evidence =
  | { kind: "measured"; source: string; platform: string | null; why: string }
  | { kind: "typed_in"; source: string; platform: string | null; why: string };

export type KpiRow = {
  show: string;
  objective: string;
  name: string;
  current: number;
  target: number;
  unit: string;
  /** 0-100, capped. A target of zero counts as met. */
  progress: number;
  evidence: Evidence;
};

export type ShowGoal = {
  slug: string;
  name: string;
  statement: string;
  by: string;
  progress: number;
  kpis: KpiRow[];
};

export type EvidenceTally = { total: number; measured: number; typedIn: number; sentence: string };

export type PublishedRow = { show: string; platform: string; status: string; liveUrl: string | null; scheduledFor: string };

export type PersonaRow = { name: string; description: string; evidence: string[] };
export type AudienceBlock = { slug: string; name: string; brand: string; personas: PersonaRow[]; watching: "unknown" };

export type SourceRow = { source: string; platform: string | null; channel: string; measured: boolean };

export type AnalyticsData = {
  goals: ShowGoal[];
  tally: EvidenceTally;
  sources: SourceRow[];
  published: PublishedRow[];
  audience: AudienceBlock[];
  /** Platforms whose analytics are connected. Empty until the first one is wired up. */
  measuringPlatforms: string[];
};

export type AnalyticsRows = {
  shows: { id: string; brand_id: string; slug: string; name: string; compass: unknown }[];
  brands: { id: string; name: string; brand_kit: unknown }[];
  channels: { platform: string; handle: string; status: string }[];
  posts: { platform: string; status: string; live_url: string | null; scheduled_for: string; show_id: string | null }[];
  /** Platforms whose analytics are connected and reporting. Empty today. */
  measuringPlatforms: string[];
};

/** Evidence sources that name no platform: the number was always going to be typed in. */
const BY_HAND = ["manual", "by_hand", "byhand", "hand", "typed", "estimate", "guess", "none", "self_reported"];

/** Longest prefix wins, so youtube_shorts never reads as youtube. */
const SOURCE_PLATFORMS: [string, string][] = [
  ["youtube_shorts", "youtube_shorts"],
  ["shorts", "youtube_shorts"],
  ["youtube", "youtube"],
  ["instagram", "instagram"],
  ["tiktok", "tiktok"],
  ["threads", "threads"],
  ["linkedin", "linkedin"],
  ["twitter", "x"],
  ["x_analytics", "x"],
  ["spotify", "podcast"],
  ["apple_podcasts", "podcast"],
  ["podcast", "podcast"],
  ["substack", "newsletter"],
  ["beehiiv", "newsletter"],
  ["mailchimp", "newsletter"],
  ["newsletter", "newsletter"],
  ["plausible", "website"],
  ["ga4", "website"],
  ["website", "website"],
];

/** The platform an evidence source names, or null when it names none. */
export function platformOfSource(source: string): string | null {
  const key = source.trim().toLowerCase();
  if (key === "" || BY_HAND.includes(key.split(/[.:/ ]/)[0] ?? "")) return null;
  for (const [prefix, platform] of SOURCE_PLATFORMS) if (key.startsWith(prefix)) return platform;
  return null;
}

/** 0-100, capped at 100. A target of zero is already met. */
export function progressOf(current: number, target: number): number {
  if (target === 0) return 100;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

/**
 * Whether a KPI's number is measured or typed in. A source whose platform has no
 * connected analytics is typed in, however precise the source string looks.
 */
export function evidenceFor(source: string, measuring: readonly string[], channels: readonly { platform: string; status: string }[]): Evidence {
  const platform = platformOfSource(source);
  if (platform === null) {
    return { kind: "typed_in", source, platform: null, why: "Set by hand. This source names no platform to read it from." };
  }
  if (measuring.includes(platform)) {
    return { kind: "measured", source, platform, why: `Read from ${platformName(platform)} analytics.` };
  }
  const channel = channels.find((c) => c.platform === platform);
  if (!channel) {
    return { kind: "typed_in", source, platform, why: `Typed in by hand. No ${platformName(platform)} account is set up yet.` };
  }
  const connected = channel.status === "connected";
  return {
    kind: "typed_in",
    source,
    platform,
    why: connected
      ? `Typed in by hand. The ${platformName(platform)} account is connected for posting, but its analytics are not read yet.`
      : `Typed in by hand. The ${platformName(platform)} account is not connected.`,
  };
}

/** How many numbers are real and how many are still hand-typed, said plainly. */
export function tallyEvidence(kpis: readonly KpiRow[]): EvidenceTally {
  const total = kpis.length;
  const measured = kpis.filter((k) => k.evidence.kind === "measured").length;
  const typedIn = total - measured;
  if (total === 0) return { total, measured, typedIn, sentence: "No goals are written yet, so there are no numbers to check." };
  if (typedIn === 0) return { total, measured, typedIn, sentence: `All ${total} numbers are read from connected analytics.` };
  if (measured === 0) return { total, measured, typedIn, sentence: `All ${total} numbers are typed in by hand. None is measured yet.` };
  return { total, measured, typedIn, sentence: `${measured} of ${total} numbers are measured. ${typedIn} are still typed in by hand.` };
}

/** The whole screen, shaped from rows. Pure, so every rule above is tested. */
export function buildAnalytics(rows: AnalyticsRows): AnalyticsData {
  const measuring = rows.measuringPlatforms;
  const brandById = new Map(rows.brands.map((b) => [b.id, b]));
  const showName = (id: string | null) => (id === null ? "A show" : rows.shows.find((s) => s.id === id)?.name ?? "A show");

  const goals = rows.shows.flatMap((show) => {
    const goal = goalOf(show.compass);
    if (!goal) return [];
    const kpis = goal.objectives.flatMap((o) =>
      o.kpis.map((k) => ({
        show: show.name,
        objective: o.title,
        name: k.name,
        current: k.current,
        target: k.target,
        unit: k.unit,
        progress: progressOf(k.current, k.target),
        evidence: evidenceFor(k.evidenceSource, measuring, rows.channels),
      })),
    );
    const progress = kpis.length === 0 ? 0 : Math.round(kpis.reduce((a, k) => a + k.progress, 0) / kpis.length);
    return [{ slug: show.slug, name: show.name, statement: goal.statement, by: goal.by, progress, kpis }];
  });

  const kpis = goals.flatMap((g) => g.kpis);

  const sources = [...new Map(kpis.map((k) => [k.evidence.source, k])).values()]
    .map((k) => ({
      source: k.evidence.source,
      platform: k.evidence.platform,
      channel: channelLabel(k.evidence.platform, rows.channels),
      measured: k.evidence.kind === "measured",
    }))
    .sort((a, b) => a.source.localeCompare(b.source));

  const published = rows.posts
    .map((p) => ({ show: showName(p.show_id), platform: platformName(p.platform), status: p.status, liveUrl: p.live_url, scheduledFor: p.scheduled_for }))
    .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));

  const audience = rows.shows.map((show) => {
    const brand = brandById.get(show.brand_id);
    return {
      slug: show.slug,
      name: show.name,
      brand: brand?.name ?? "No brand",
      personas: personasOf(brand?.brand_kit),
      watching: "unknown" as const,
    };
  });

  return { goals, tally: tallyEvidence(kpis), sources, published, audience, measuringPlatforms: [...measuring] };
}

function channelLabel(platform: string | null, channels: readonly { platform: string; handle: string; status: string }[]): string {
  if (platform === null) return "No platform named";
  const found = channels.filter((c) => c.platform === platform);
  if (found.length === 0) return `No ${platformName(platform)} account yet`;
  return listJoin(found.map((c) => `${c.handle}${c.status === "connected" ? "" : " (not connected)"}`));
}

type Goal = { statement: string; by: string; objectives: { title: string; kpis: { name: string; current: number; target: number; unit: string; evidenceSource: string }[] }[] };

/** The main goal out of a stored compass, or null when nothing usable is there. */
export function goalOf(compass: unknown): Goal | null {
  const main = asRecord(asRecord(compass)["mainGoal"]);
  const statement = typeof main["statement"] === "string" ? main["statement"] : null;
  if (statement === null) return null;
  const objectives = (Array.isArray(main["objectives"]) ? main["objectives"] : []).flatMap((raw) => {
    const o = asRecord(raw);
    const title = typeof o["title"] === "string" ? o["title"] : null;
    if (title === null) return [];
    const kpis = (Array.isArray(o["kpis"]) ? o["kpis"] : []).flatMap((rawKpi) => {
      const k = asRecord(rawKpi);
      if (typeof k["name"] !== "string" || typeof k["current"] !== "number" || typeof k["target"] !== "number") return [];
      return [{
        name: k["name"],
        current: k["current"],
        target: k["target"],
        unit: typeof k["unit"] === "string" ? k["unit"] : "",
        evidenceSource: typeof k["evidenceSource"] === "string" ? k["evidenceSource"] : "",
      }];
    });
    return kpis.length === 0 ? [] : [{ title, kpis }];
  });
  return { statement, by: typeof main["by"] === "string" ? main["by"] : "", objectives };
}

/** Personas out of a brand kit. At most three, and only ones with a name and a description. */
export function personasOf(brandKit: unknown): PersonaRow[] {
  const raw = asRecord(brandKit)["personas"];
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const p = asRecord(entry);
    if (typeof p["name"] !== "string" || typeof p["description"] !== "string") return [];
    const evidence = (Array.isArray(p["evidence"]) ? p["evidence"] : []).flatMap((e) => {
      const r = asRecord(e);
      const note = typeof r["note"] === "string" ? r["note"] : null;
      const kind = typeof r["kind"] === "string" ? r["kind"] : "";
      return note === null ? [] : [kind === "" ? note : `${kind}: ${note}`];
    });
    return [{ name: p["name"], description: p["description"], evidence }];
  }).slice(0, 3);
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
