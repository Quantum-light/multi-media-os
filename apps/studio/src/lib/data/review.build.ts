import { CutOutput, UnderstandOutput, ClipOutput } from "@mmos/contracts";
import { platformName } from "@/lib/format";

export type ReviewListItem = { id: string; title: string; show: string; waitingSince: string; flagged: boolean };

export type ReviewPiece = {
  id: string;
  kind: "title" | "description" | "chapters" | "caption";
  platform: string;
  label: string;
  body: string;
  version: number;
  options: string[];
  limit: number;
  versions: { version: number; body: string; author: "agent" | "person" | "chat"; note: string | null; at: string }[];
};

export type ReviewCut = { startS: number; endS: number; reason: string; text: string };

/**
 * How the shorts came out, as a line Review can read. The slate itself lives in
 * public.clips and belongs to Clip Studio; Review only says how many and links there.
 */
export type ClipSlateSummary = { target: number; chosen: number; reserve: number; shortfall: number; line: string };
export type ReviewPost = { channelId: string; platform: string; handle: string; when: string | null };

export type ReviewEpisode = {
  id: string;
  title: string;
  show: string;
  state: string;
  flagged: boolean;
  previewUrl: string | null;
  durationS: number | null;
  keptS: number | null;
  cuts: ReviewCut[];
  summary: string | null;
  moments: { startS: number; kind: string; quote: string }[];
  clipSlate: ClipSlateSummary | null;
  pieces: ReviewPiece[];
  posts: ReviewPost[];
  canApprove: boolean;
  chatReady: boolean;
};

const LIMITS: Record<string, number> = { title: 100, description: 5000, chapters: 5000 };
const CAPTION_LIMITS: Record<string, number> = { youtube: 5000, instagram: 2200, threads: 500, tiktok: 2200, x: 280, linkedin: 3000 };
const ORDER = ["title", "description", "chapters", "caption"];

export type PieceRow = { id: string; kind: string; platform: string; body: string; version: number; options: string[]; piece_versions: { version: number; body: string; author: string; note: string | null; created_at: string }[] };

export function labelOf(kind: string, platform: string): string {
  if (kind === "caption") return `${platformName(platform)} caption`;
  if (kind === "chapters") return "Chapters";
  return kind === "title" ? "Title" : "Description";
}

/** Pieces in reading order, each with its limit and its history, newest first. */
export function buildPieces(rows: readonly PieceRow[]): ReviewPiece[] {
  return [...rows]
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.platform.localeCompare(b.platform))
    .map((p) => ({
      id: p.id,
      kind: p.kind as ReviewPiece["kind"],
      platform: p.platform,
      label: labelOf(p.kind, p.platform),
      body: p.body,
      version: p.version,
      options: p.options,
      limit: p.kind === "caption" ? CAPTION_LIMITS[p.platform] ?? 2200 : LIMITS[p.kind] ?? 5000,
      versions: [...p.piece_versions]
        .sort((a, b) => b.version - a.version)
        .map((v) => ({ version: v.version, body: v.body, author: (v.author === "person" || v.author === "chat" ? v.author : "agent") as "agent" | "person" | "chat", note: v.note, at: v.created_at })),
    }));
}

/** The step results Review shows, each read through its contract (an old or odd result is simply left out). */
export function buildAnalysis(outputs: { cut: unknown; understand: unknown; clip: unknown }) {
  const cut = CutOutput.safeParse(outputs.cut);
  const u = UnderstandOutput.safeParse(outputs.understand);
  const clip = ClipOutput.safeParse(outputs.clip);
  return {
    durationS: cut.success ? cut.data.durationS : null,
    keptS: cut.success ? cut.data.keptS : null,
    cuts: cut.success ? cut.data.cuts.map((c) => ({ startS: c.startS, endS: c.endS, reason: c.reason, text: c.text })) : [],
    summary: u.success ? u.data.summary : null,
    moments: u.success ? u.data.moments.map((m) => ({ startS: m.startS, kind: m.kind, quote: m.quote })) : [],
    clipSlate: clip.success ? slateSummary(clip.data) : null,
  };
}

/** "19 chosen of the 21 this episode wanted, 4 held in reserve." */
export function slateSummary(o: { target: number; chosen: number; reserve: number; shortfall: number }): ClipSlateSummary {
  const held = o.reserve === 0 ? "" : `, ${o.reserve} held in reserve`;
  const line = o.chosen === 0 ? `Nothing cleared the bar. This episode wanted ${o.target}.` : `${o.chosen} chosen of the ${o.target} this episode wanted${held}.`;
  return { target: o.target, chosen: o.chosen, reserve: o.reserve, shortfall: o.shortfall, line };
}

/** "Tue 13 Oct, 09:00" in the workspace's time zone. */
export function whenLabel(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(new Date(iso));
}

/** The next playback position: inside a cut, jump to its end (cuts that touch are crossed in one jump). */
export function skipCuts(t: number, cuts: readonly { startS: number; endS: number }[]): number {
  let at = t;
  for (const c of [...cuts].sort((a, b) => a.startS - b.startS)) {
    if (at >= c.startS && at < c.endS - 0.05) at = c.endS;
  }
  return at;
}
