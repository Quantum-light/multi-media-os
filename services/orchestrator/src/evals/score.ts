import { z } from "zod";
import type { WriteOutput } from "@mmos/contracts";

/** What Grace actually published for a golden episode: the answer key. */
export const Approved = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  chapters: z.array(z.object({ atS: z.number().min(0), title: z.string().min(1) })),
  /** Where it was published, for the record. */
  url: z.string().url().optional(),
});
export type Approved = z.infer<typeof Approved>;

export type Scores = {
  /** Share of approved chapters with a drafted chapter within 30 s (0-1). */
  chapterRecall: number;
  /** Drafted chapters per approved chapter (1 is ideal). */
  chapterCountRatio: number;
  /** Best word overlap between any title option and the approved title (0-1). */
  titleOverlap: number;
  /** Share of the approved description's key words that the draft also uses (0-1). */
  descriptionCoverage: number;
  /** One number to watch: the mean of the four above, with the count ratio folded to 0-1. */
  overall: number;
};

const STOP = new Set("the and for with that this from your you are was were have has had what when where which who into about there their they them then than just like will would could should our out not but all can how why its it's i'm we're".split(" "));

export function contentWords(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/https?:\S+/g, " ").replace(/[^\p{L}\p{N}\s']/gu, " ").split(/\s+/).map((w) => w.replace(/'s$|'$/, "")).filter((w) => w.length >= 4 && !STOP.has(w)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter += 1;
  return inter / (a.size + b.size - inter);
}

const round = (x: number) => Math.round(x * 1000) / 1000;

export function score(draft: Pick<WriteOutput, "titleOptions" | "description" | "chapters">, approved: Approved, toleranceS = 30): Scores {
  const hits = approved.chapters.filter((a) => draft.chapters.some((d) => Math.abs(d.atS - a.atS) <= toleranceS)).length;
  const chapterRecall = approved.chapters.length ? hits / approved.chapters.length : draft.chapters.length === 0 ? 1 : 0;
  const chapterCountRatio = approved.chapters.length ? draft.chapters.length / approved.chapters.length : 0;
  const approvedTitle = contentWords(approved.title);
  const titleOverlap = Math.max(0, ...draft.titleOptions.map((t) => jaccard(contentWords(t), approvedTitle)));
  const key = contentWords(approved.description);
  const drafted = contentWords(draft.description);
  const descriptionCoverage = key.size ? [...key].filter((w) => drafted.has(w)).length / key.size : 1;
  const countScore = chapterCountRatio === 0 ? 0 : Math.min(chapterCountRatio, 1 / chapterCountRatio);
  return {
    chapterRecall: round(chapterRecall),
    chapterCountRatio: round(chapterCountRatio),
    titleOverlap: round(titleOverlap),
    descriptionCoverage: round(descriptionCoverage),
    overall: round((chapterRecall + countScore + titleOverlap + descriptionCoverage) / 4),
  };
}

/** "0:00 Welcome" lines (as pasted from YouTube) into chapters. */
export function parseChapterLines(text: string): { atS: number; title: string }[] {
  const out: { atS: number; title: string }[] = [];
  for (const line of text.split("\n")) {
    const m = line.trim().match(/^\(?((?:\d+:)?\d{1,2}:\d{2})\)?\s*[-–—:]?\s*(.+)$/);
    if (!m) continue;
    const parts = m[1]!.split(":").map(Number);
    const atS = parts.reduce((acc, n) => acc * 60 + n, 0);
    out.push({ atS, title: m[2]!.trim() });
  }
  return out;
}
