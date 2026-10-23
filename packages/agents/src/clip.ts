import { ClipProposal, type Cut, type ScoredClip, type TranscriptDoc } from "@mmos/contracts";
import { costPence, type Llm, type Usage } from "./anthropic";
import { transcriptLines } from "./transcript-view";
import { quoteMatch } from "./understand";
import { compassBrief, HUMAN_SOURCED } from "./voice";

export type ClipShow = { showName: string; brandName: string; compass: Record<string, unknown> | null };

/** Grace's four signals, in her words, so the model hunts for these and not for "engagement". */
const SIGNALS = [
  "standalone_idea: a complete thought that makes sense with no context around it.",
  "opening_line: the first sentence would stop someone scrolling.",
  "surprising: it cuts against what people assume, or she argues the opposite of the usual line.",
  "personal: candid, funny, or out of her own life.",
];

/**
 * Ask for half again as many as the show wants. Selection drops overlapping cuts of one
 * moment and anything under the bar, so a slate of 21 needs more than 21 offered.
 */
export function candidatesWanted(target: number): number {
  return Math.ceil(target * 1.5);
}

export function clipPrompt(show: ClipShow, doc: Pick<TranscriptDoc, "words" | "durationS">, cuts: readonly Cut[], target: number): { system: string; prompt: string } {
  const wanted = candidatesWanted(target);
  const system = [
    `You find the shorts for "${show.showName}" by ${show.brandName}. You read a recorded episode and pick the passages that would hold up on their own as a short.`,
    HUMAN_SOURCED,
    "Times are seconds on the source recording, taken from the [Ns] marks at the start of each line. Never guess a time that is not in the transcript, and never write a word she did not say.",
    "A clip is weak unless it would make sense to someone who has seen none of the episode. If this episode only has a few of those, offer only those: a thin slate is honest, a padded one is not.",
  ].join("\n\n");
  const prompt = [
    `Show Vision:\n${compassBrief(show.compass).text}`,
    `Recording length: ${Math.round(doc.durationS)} seconds. Lines already cut (silences, retakes) are left out.`,
    `Offer up to ${wanted} candidates. The show wants ${target} shorts, and weak or overlapping ones are dropped afterwards, so more than ${target} gives the choosing room. Fewer is fine when the episode has no more in it.`,
    "For each candidate give:",
    "- startS and endS: seconds on the source recording. Between 15 and 90 seconds, cut where she starts and finishes the thought.",
    `- signal: which one of these it is, the strongest if more than one fits.\n  ${SIGNALS.join("\n  ")}`,
    "- score: 0-100, how strongly it carries that signal, judged against the rest of this episode.",
    "- hook: her first line in the clip, word for word, as the clip would open.",
    "- quote: what she says in the clip, copied from the transcript, so a person can judge it without opening the video.",
    "- reason: one sentence on why it clears the bar.",
    "Do not offer two candidates of the same moment; pick the better cut of it. Spread them across the episode and across the four signals where the episode allows.",
    "Transcript:",
    transcriptLines(doc, cuts).join("\n"),
  ].join("\n\n");
  return { system, prompt };
}

/**
 * Holds the model to the recording. A clip whose quote was not really said, or which runs
 * past the end, is not offered: the finder may come up short, but never invents.
 */
export function groundClips(candidates: readonly ScoredClip[], doc: Pick<TranscriptDoc, "words" | "durationS">): { candidates: ScoredClip[]; dropped: number } {
  const kept = candidates
    .map((c) => ({ ...c, endS: Math.min(c.endS, doc.durationS) }))
    .filter((c) => c.endS > c.startS && quoteMatch(doc, c.startS, c.endS, c.quote) >= 0.7);
  return { candidates: kept, dropped: candidates.length - kept.length };
}

/** One paid pass over the episode: the model proposes, `selectClips` in the worker decides. */
export async function runFindClips(
  llm: Llm,
  show: ClipShow,
  doc: Pick<TranscriptDoc, "words" | "durationS">,
  cuts: readonly Cut[],
  target: number,
  signal?: AbortSignal,
): Promise<{ candidates: ScoredClip[]; dropped: number; usage: Usage; costPence: number }> {
  const { system, prompt } = clipPrompt(show, doc, cuts, target);
  const { data, usage } = await llm.structured({
    system,
    prompt,
    tool: { name: "offer_clips", description: "Offer the passages from this episode that would hold up as shorts.", schema: ClipProposal },
    maxTokens: 12000,
    ...(signal ? { signal } : {}),
  });
  const grounded = groundClips(data.candidates, doc);
  return { ...grounded, usage, costPence: costPence(usage) };
}
