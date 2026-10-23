import type { Cut, CutReason, Word } from "@mmos/contracts";

export type CutRules = {
  /** A pause longer than this is shortened. */
  silenceS: number;
  /** Breathing room left either side of a shortened pause. */
  padS: number;
  /** Retakes further apart than this are treated as deliberate repetition. */
  retakeWindowS: number;
  maxRetakeS: number;
};

export const DEFAULT_RULES: CutRules = { silenceS: 1.0, padS: 0.3, retakeWindowS: 15, maxRetakeS: 20 };

const FILLER = /^(u+m+|u+h+|e+r+m+|e+r+|uhm+|h+m+|m+h*m+)$/;
/** Doubled words that are often correct English ("had had", "that that"). */
const LEGIT_DOUBLES = new Set(["had", "that", "is", "very", "really", "so", "no", "yes", "bye", "ha"]);

const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
const s = (ms: number) => ms / 1000;

/**
 * Proposes removals from word timings alone: long pauses, filler sounds, stutters and
 * retakes (a phrase started, abandoned and said again). Deterministic, so the same
 * transcript always gets the same cut list; a person confirms it at Review.
 */
export function planCuts(words: readonly Word[], durationS: number, rules: CutRules = DEFAULT_RULES): Cut[] {
  const cuts: Cut[] = [];
  const add = (startS: number, endS: number, reason: CutReason, text: string) => {
    if (endS - startS >= 0.15) cuts.push({ startS: round(startS), endS: round(endS), reason, text });
  };
  if (words.length === 0) return [];

  // Pauses: before the first word, between words, after the last.
  const first = words[0]!;
  if (s(first.startMs) > rules.silenceS) add(0, s(first.startMs) - rules.padS, "silence", "");
  for (let i = 1; i < words.length; i++) {
    const gap = s(words[i]!.startMs) - s(words[i - 1]!.endMs);
    if (gap > rules.silenceS) add(s(words[i - 1]!.endMs) + rules.padS, s(words[i]!.startMs) - rules.padS, "silence", "");
  }
  const last = words[words.length - 1]!;
  if (durationS - s(last.endMs) > rules.silenceS) add(s(last.endMs) + rules.padS, durationS, "silence", "");

  // Fillers and stutters.
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const n = norm(w.text);
    const next = words[i + 1];
    if (FILLER.test(n)) {
      add(s(w.startMs), next ? Math.min(s(next.startMs), s(w.endMs) + 0.25) : s(w.endMs), "filler", w.text);
    } else if (next && n && n === norm(next.text) && !LEGIT_DOUBLES.has(n) && s(next.startMs) - s(w.startMs) < 1.2) {
      add(s(w.startMs), s(next.startMs), "false_start", w.text);
    }
  }

  // Retakes: the same 3-8 words said again within the window; the first attempt goes.
  for (let i = 0; i < words.length; i++) {
    for (let n = 8; n >= 3; n--) {
      const phrase = words.slice(i, i + n).map((w) => norm(w.text));
      if (phrase.length < n || phrase.some((p) => !p || FILLER.test(p))) continue;
      let found = -1;
      for (let j = i + n; j < Math.min(words.length - n + 1, i + n + 30); j++) {
        if (s(words[j]!.startMs) - s(words[i]!.startMs) > rules.retakeWindowS) break;
        if (phrase.every((p, k) => p === norm(words[j + k]!.text))) {
          found = j;
          break;
        }
      }
      if (found < 0) continue;
      const startS = s(words[i]!.startMs);
      const endS = s(words[found]!.startMs);
      if (endS - startS <= rules.maxRetakeS) {
        const said = words.slice(i, found).map((w) => w.text).join(" ");
        add(startS, endS, found - i <= 6 ? "false_start" : "retake", said);
        i = found - 1;
      }
      break;
    }
  }
  return merge(cuts);
}

const round = (x: number) => Math.round(x * 100) / 100;

const RANK: Record<CutReason, number> = { retake: 3, false_start: 2, filler: 1, silence: 0 };

/** Sorted, non-overlapping; where cuts overlap, the more telling reason wins. Touching cuts stay separate so Review shows each reason. */
export function merge(cuts: readonly Cut[]): Cut[] {
  const sorted = [...cuts].sort((a, b) => a.startS - b.startS);
  const out: Cut[] = [];
  for (const c of sorted) {
    const prev = out[out.length - 1];
    if (prev && c.startS < prev.endS) {
      const reason = RANK[c.reason] > RANK[prev.reason] ? c.reason : prev.reason;
      out[out.length - 1] = { startS: prev.startS, endS: Math.max(prev.endS, c.endS), reason, text: [prev.text, c.text].filter(Boolean).join(" ") };
    } else out.push({ ...c });
  }
  return out;
}

export function removedSeconds(cuts: readonly Cut[]): number {
  return round(cuts.reduce((sum, c) => sum + (c.endS - c.startS), 0));
}
