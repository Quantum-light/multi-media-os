import { toEditedTime, type ClipCandidate, type Cue, type Cut, type EditedChapter, type Moment, type MomentKind } from "@mmos/contracts";

const PREFERENCE: MomentKind[] = ["story", "teaching", "practice", "claim", "question"];

const sentence = (quote: string) => {
  const first = quote.split(/(?<=[.?!])\s+/)[0] ?? quote;
  return first.length > 90 ? `${first.slice(0, 89).trimEnd()}…` : first;
};

/** Share of a span that the cut list removes. */
function removedShare(startS: number, endS: number, cuts: readonly Cut[]): number {
  let removed = 0;
  for (const c of cuts) removed += Math.max(0, Math.min(endS, c.endS) - Math.max(startS, c.startS));
  return removed / (endS - startS);
}

/** Up to five short-form candidates: the creator's strongest moments, 15-90 s, never overlapping. */
export function planClips(moments: readonly Moment[], cuts: readonly Cut[], durationS: number, max = 5): ClipCandidate[] {
  const ranked = [...moments].sort((a, b) => PREFERENCE.indexOf(a.kind) - PREFERENCE.indexOf(b.kind) || a.startS - b.startS);
  const picked: ClipCandidate[] = [];
  for (const m of ranked) {
    if (picked.length >= max) break;
    let startS = m.startS;
    let endS = Math.min(m.endS, startS + 90);
    if (endS - startS < 15) endS = Math.min(durationS, startS + 15);
    if (endS - startS < 15) startS = Math.max(0, endS - 15);
    if (endS - startS < 15 || removedShare(startS, endS, cuts) > 0.3) continue;
    if (picked.some((p) => startS < p.endS && endS > p.startS)) continue;
    picked.push({ startS, endS, kind: m.kind, title: sentence(m.quote), quote: m.quote });
  }
  return picked.sort((a, b) => a.startS - b.startS);
}

/** Where the brand graphics go on the edited master. M7 renders them. */
export function planCues(args: { showName: string; chapters: readonly EditedChapter[]; moments: readonly Moment[]; cuts: readonly Cut[]; editedDurationS: number }): Cue[] {
  const { showName, chapters, moments, cuts, editedDurationS } = args;
  const cues: Cue[] = [];
  if (editedDurationS > 20) cues.push({ atS: 3, durationS: 5, block: "lower_third", text: showName.slice(0, 200) });
  for (const c of chapters.slice(1)) cues.push({ atS: c.atS, durationS: 4, block: "chapter_card", text: c.title });
  const quotes = moments.filter((m) => m.kind === "claim" || m.kind === "teaching").slice(0, 2);
  for (const m of quotes) {
    const at = toEditedTime(m.startS, cuts);
    if (cues.some((c) => Math.abs(c.atS - at) < 8)) continue;
    const text = m.quote.length > 200 ? `${m.quote.slice(0, 199).trimEnd()}…` : m.quote;
    cues.push({ atS: at, durationS: 6, block: "quote_card", text });
  }
  if (editedDurationS > 30) cues.push({ atS: Math.max(0, editedDurationS - 15), durationS: 15, block: "end_card", text: `Thanks for spending this time with ${showName}`.slice(0, 200) });
  return cues.sort((a, b) => a.atS - b.atS);
}
