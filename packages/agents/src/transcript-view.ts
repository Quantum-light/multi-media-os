import { isRemoved, stamp, type Cut, type TranscriptDoc } from "@mmos/contracts";

/**
 * The transcript as the model reads it: one line per turn, each starting with its source
 * time in seconds, removed words left out. Times stay on the source recording so the
 * model's answers can be checked against the word timings.
 */
export function transcriptLines(doc: Pick<TranscriptDoc, "words">, cuts: readonly Pick<Cut, "startS" | "endS">[], maxGapS = 1.5): string[] {
  const lines: string[] = [];
  let current: { at: number; speaker: string | null; words: string[]; lastEnd: number } | null = null;
  const flush = () => {
    if (current && current.words.length) lines.push(`[${Math.floor(current.at)}s ${stamp(current.at)}] ${current.speaker ?? "?"}: ${current.words.join(" ")}`);
    current = null;
  };
  for (const w of doc.words) {
    const startS = w.startMs / 1000;
    if (isRemoved(startS, cuts)) continue;
    const sentenceEnd = current !== null && /[.?!]$/.test(current.words[current.words.length - 1] ?? "");
    if (!current || current.speaker !== w.speaker || startS - current.lastEnd > maxGapS || (sentenceEnd && current.words.length > 60)) {
      flush();
      current = { at: startS, speaker: w.speaker, words: [], lastEnd: startS };
    }
    current.words.push(w.text);
    current.lastEnd = w.endMs / 1000;
  }
  flush();
  return lines;
}

/** The creator's exact words between two source times, for checking quotes. */
export function wordsBetween(doc: Pick<TranscriptDoc, "words">, startS: number, endS: number): string {
  return doc.words.filter((w) => w.startMs / 1000 >= startS - 0.5 && w.endMs / 1000 <= endS + 0.5).map((w) => w.text).join(" ");
}
