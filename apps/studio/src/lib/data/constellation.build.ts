import { dayKey, platformName, plural } from "@/lib/format";

export type ConstellationRows = {
  themes: { id: string; name: string; slug: string }[];
  edges: { from_kind: string; from_id: string; to_kind: string; to_id: string; kind: string; weight: number }[];
  anchors: { id: string; name: string; date: string; recurrence: string; scope: string }[];
  holds: { id: string; anchor_id: string; piece_id: string; piece_kind: string; created_at: string }[];
  episodes: { id: string; title: string | null }[];
  pieces: { id: string; kind: string; platform: string; episode_id: string }[];
};

/** One end of a connection, named the way a person would say it. */
export type ThemeLink = { id: string; label: string; relation: string; weight: number };
export type ThemeNode = { id: string; name: string; slug: string; links: ThemeLink[]; linkCount: number };
export type HeldPiece = { id: string; label: string; source: string | null; kind: string; anchorId: string; anchorName: string; when: string; whenLabel: string };
export type Moment = { id: string; name: string; scope: string; when: string; whenLabel: string; relative: string; inDays: number; past: boolean; held: HeldPiece[] };
export type HoldablePiece = { value: string; label: string };
export type ConstellationData = {
  themes: ThemeNode[];
  /** Connections with no theme at either end: one episode following on from another, and the like. */
  otherLinks: { id: string; from: string; to: string; relation: string }[];
  moments: Moment[];
  held: HeldPiece[];
  holdable: HoldablePiece[];
  counts: { themes: number; links: number; moments: number; held: number };
};

const RELATIONS: Record<string, string> = {
  same_theme: "same theme",
  follows_on: "follows on from",
  answers: "answers",
  contradicts: "contradicts",
  part_of_arc: "part of an arc with",
  held_for: "held for",
  resurfaced_at: "resurfaced at",
};

const KIND_WORDS: Record<string, string> = { episode: "An episode", piece: "A piece", moment: "A moment", theme: "A theme", time_anchor: "A moment in time" };

/** Themes, what connects to what, and the moments being held for. Pure and tested. */
export function buildConstellation(rows: ConstellationRows, now: Date, timeZone: string): ConstellationData {
  const today = dayKey(now, timeZone);
  const episodeTitle = new Map(rows.episodes.map((e) => [e.id, e.title?.trim() || "An episode without a title yet"]));
  const pieceLabel = new Map(rows.pieces.map((p) => [p.id, `${sentence(p.kind)} for ${platformName(p.platform)}`]));
  const pieceSource = new Map(rows.pieces.map((p) => [p.id, episodeTitle.get(p.episode_id) ?? null]));
  const themeName = new Map(rows.themes.map((t) => [t.id, t.name]));
  const anchorName = new Map(rows.anchors.map((a) => [a.id, a.name]));

  const label = (kind: string, id: string): string =>
    (kind === "episode" ? episodeTitle.get(id) : kind === "piece" ? pieceLabel.get(id) : kind === "theme" ? themeName.get(id) : kind === "time_anchor" ? anchorName.get(id) : undefined) ??
    KIND_WORDS[kind] ??
    "Something";

  const moments = momentsOf(rows, today);
  const whenOf = new Map(moments.map((m) => [m.id, m]));
  const held = rows.holds
    .map((h) => {
      const moment = whenOf.get(h.anchor_id);
      return {
        id: h.id,
        label: label(h.piece_kind, h.piece_id),
        source: h.piece_kind === "piece" ? pieceSource.get(h.piece_id) ?? null : null,
        kind: h.piece_kind,
        anchorId: h.anchor_id,
        anchorName: anchorName.get(h.anchor_id) ?? "A moment in time",
        when: moment?.when ?? "",
        whenLabel: moment?.whenLabel ?? "a date that has passed",
      };
    })
    .sort((a, b) => a.when.localeCompare(b.when) || a.label.localeCompare(b.label));
  for (const m of moments) m.held = held.filter((h) => h.anchorId === m.id);

  const themes = rows.themes
    .map((t) => {
      const links = rows.edges
        .filter((e) => (e.from_kind === "theme" && e.from_id === t.id) || (e.to_kind === "theme" && e.to_id === t.id))
        .map((e, i) => {
          const far = e.from_kind === "theme" && e.from_id === t.id ? { kind: e.to_kind, id: e.to_id } : { kind: e.from_kind, id: e.from_id };
          return { id: `${t.id}-${i}`, label: label(far.kind, far.id), relation: RELATIONS[e.kind] ?? e.kind.replace(/_/g, " "), weight: e.weight };
        })
        .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label));
      return { id: t.id, name: t.name, slug: t.slug, links, linkCount: links.length };
    })
    .sort((a, b) => b.linkCount - a.linkCount || a.name.localeCompare(b.name));

  const otherLinks = rows.edges
    .filter((e) => e.from_kind !== "theme" && e.to_kind !== "theme")
    .map((e, i) => ({ id: `${e.from_id}-${e.to_id}-${i}`, from: label(e.from_kind, e.from_id), to: label(e.to_kind, e.to_id), relation: RELATIONS[e.kind] ?? e.kind.replace(/_/g, " ") }))
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  return {
    themes,
    otherLinks,
    moments,
    held,
    holdable: holdableOf(rows, episodeTitle, pieceLabel, pieceSource),
    counts: { themes: themes.length, links: rows.edges.length, moments: moments.filter((m) => !m.past).length, held: held.length },
  };
}

/** Every moment still ahead, plus any already past one that something is being held for. */
function momentsOf(rows: ConstellationRows, today: string): Moment[] {
  const holdsFor = new Set(rows.holds.map((h) => h.anchor_id));
  return rows.anchors
    .map((a) => {
      const when = occurrence(a, today);
      const inDays = daysBetween(today, when);
      return {
        id: a.id,
        name: a.name,
        scope: a.scope,
        when,
        whenLabel: dateLabel(when),
        relative: relative(inDays),
        inDays,
        past: inDays < 0,
        held: [] as HeldPiece[],
      };
    })
    .filter((m) => (m.past ? holdsFor.has(m.id) : m.inDays <= 400))
    .sort((a, b) => a.when.localeCompare(b.when) || a.name.localeCompare(b.name));
}

/** A yearly moment lands on its next turn; a one-off keeps its own date. */
function occurrence(anchor: { date: string; recurrence: string }, today: string): string {
  if (anchor.recurrence !== "yearly") return anchor.date;
  const year = Number(today.slice(0, 4));
  const thisYear = `${year}-${anchor.date.slice(5)}`;
  return thisYear >= today ? thisYear : `${year + 1}-${anchor.date.slice(5)}`;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function dateLabel(key: string): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function relative(inDays: number): string {
  if (inDays < 0) return `${plural(-inDays, "day")} ago`;
  if (inDays === 0) return "today";
  if (inDays === 1) return "tomorrow";
  if (inDays < 45) return `in ${plural(inDays, "day")}`;
  return `in ${plural(Math.round(inDays / 30), "month")}`;
}

/** What a person can put on hold: recordings first, then the pieces made from them. */
function holdableOf(rows: ConstellationRows, episodeTitle: Map<string, string>, pieceLabel: Map<string, string>, pieceSource: Map<string, string | null>): HoldablePiece[] {
  const episodes = rows.episodes.map((e) => ({ value: `episode:${e.id}`, label: episodeTitle.get(e.id) ?? "An episode" }));
  const pieces = rows.pieces.map((p) => {
    const source = pieceSource.get(p.id);
    return { value: `piece:${p.id}`, label: `${pieceLabel.get(p.id) ?? "A piece"}${source ? ` — ${source}` : ""}` };
  });
  return [...episodes, ...pieces].slice(0, 80);
}

function sentence(text: string): string {
  const words = text.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
