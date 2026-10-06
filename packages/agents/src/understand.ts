import { Understanding, type Cut, type TranscriptDoc } from "@mmos/contracts";
import { costPence, type Llm, type Usage } from "./anthropic";
import { transcriptLines, wordsBetween } from "./transcript-view";
import { compassBrief, HUMAN_SOURCED } from "./voice";

export type UnderstandShow = { showName: string; brandName: string; compass: Record<string, unknown> | null };

export function understandPrompt(show: UnderstandShow, doc: Pick<TranscriptDoc, "words" | "durationS">, cuts: readonly Cut[]): { system: string; prompt: string } {
  const vision = compassBrief(show.compass);
  const system = [
    `You are the story editor for "${show.showName}" by ${show.brandName}. You read a recorded episode and map it: chapters, the moments worth reusing, themes, and how it serves the show's pillars.`,
    HUMAN_SOURCED,
    "Times are seconds on the source recording, taken from the [Ns] marks at the start of each line. Never guess a time that is not in the transcript.",
  ].join("\n\n");
  const prompt = [
    `Show Vision:\n${vision.text}`,
    `Recording length: ${Math.round(doc.durationS)} seconds. Lines already cut (silences, retakes) are left out.`,
    "Return:",
    "- summary: two to four sentences, in plain words, of what the creator actually covers.",
    "- chapters: where the conversation turns, in order; the first at the first line's time. One every 1-4 minutes for a short episode, fewer for long stretches on one topic. Titles 2-6 words, specific, no clickbait.",
    "- moments: the strongest stand-alone passages (story, claim, teaching, practice, question), 15-90 seconds each, quote copied word for word from the transcript, why = one line on why it stands alone.",
    "- themes: 1-6 short reusable theme names with kebab-case slugs (e.g. 'Time and money', 'time-and-money').",
    `- pillars: for each content pillar this episode really serves, a score 0-1 and one line of evidence. ${vision.pillars.length ? `Use only these pillar names exactly: ${vision.pillars.join(" | ")}.` : "There are no pillars yet, so return none."}`,
    "Transcript:",
    transcriptLines(doc, cuts).join("\n"),
  ].join("\n\n");
  return { system, prompt };
}

const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").split(/\s+/).filter(Boolean);

/** Share of a quote's words that really occur in the transcript between its times. */
export function quoteMatch(doc: Pick<TranscriptDoc, "words">, startS: number, endS: number, quote: string): number {
  const said = new Set(words(wordsBetween(doc, startS, endS)));
  const q = words(quote);
  if (q.length === 0) return 0;
  return q.filter((w) => said.has(w)).length / q.length;
}

/** Holds the model to the recording: drops invented quotes and unknown pillars, keeps times in range. */
export function groundUnderstanding(raw: Understanding, doc: Pick<TranscriptDoc, "words" | "durationS">, pillars: readonly string[]): Understanding & { dropped: number } {
  const end = doc.durationS;
  const chapters = [...raw.chapters]
    .filter((c) => c.startS < end - 5)
    .sort((a, b) => a.startS - b.startS)
    .filter((c, i, all) => i === 0 || c.startS - all[i - 1]!.startS >= 10);
  const moments = raw.moments
    .map((m) => ({ ...m, endS: Math.min(m.endS, end) }))
    .filter((m) => m.endS > m.startS && quoteMatch(doc, m.startS, m.endS, m.quote) >= 0.7);
  const allowed = new Set(pillars);
  return {
    summary: raw.summary,
    chapters: chapters.length ? chapters : [{ startS: 0, title: raw.chapters[0]?.title ?? "Episode" }],
    moments,
    themes: raw.themes.filter((t, i, all) => all.findIndex((x) => x.slug === t.slug) === i),
    pillars: raw.pillars.filter((p) => allowed.has(p.pillar)),
    dropped: raw.moments.length - moments.length,
  };
}

export async function runUnderstand(llm: Llm, show: UnderstandShow, doc: Pick<TranscriptDoc, "words" | "durationS">, cuts: readonly Cut[], signal?: AbortSignal): Promise<{ understanding: Understanding; dropped: number; usage: Usage; costPence: number }> {
  const { system, prompt } = understandPrompt(show, doc, cuts);
  const { data, usage } = await llm.structured({
    system,
    prompt,
    tool: { name: "map_episode", description: "Save the map of this episode.", schema: Understanding },
    maxTokens: 12000,
    ...(signal ? { signal } : {}),
  });
  const { dropped, ...understanding } = groundUnderstanding(data, doc, compassBrief(show.compass).pillars);
  return { understanding, dropped, usage, costPence: costPence(usage) };
}
