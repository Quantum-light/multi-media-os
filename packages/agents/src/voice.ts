import { VoiceKit } from "@mmos/contracts";

export type Lesson = { pieceKind: string; platform: string | null; before: string; after: string };

/** The line every agent holds to (decision 0001). */
export const HUMAN_SOURCED = [
  "Everything you write must come from what the creator actually said in this recording.",
  "Never invent a story, opinion, claim, statistic, quote, guest or promise they did not say.",
  "You may tighten, order and frame their words; you may not put new words in their mouth.",
].join(" ");

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** The voice kit and recent corrections as plain instructions for a writing prompt. */
export function voiceBrief(voiceKit: unknown, lessons: readonly Lesson[]): string {
  const parts: string[] = [];
  const kit = VoiceKit.safeParse(voiceKit);
  if (kit.success) {
    parts.push(`Voice rules:\n${kit.data.rules}`);
    if (kit.data.avoidTerms.length) parts.push(`Never use: ${kit.data.avoidTerms.join(", ")}.`);
    if (kit.data.glossary.length) parts.push(`Always write: ${kit.data.glossary.map((g) => `"${g.replace}" (not ${g.find.map((f) => `"${f}"`).join(" or ")})`).join("; ")}.`);
  } else {
    parts.push("No voice kit yet: write plainly and warmly, in British English, short sentences, no hype, no emoji walls, no clickbait.");
  }
  if (lessons.length) {
    parts.push(
      "The creator recently corrected drafts like this (learn the pattern, do not copy the topic):\n" +
        lessons
          .slice(0, 12)
          .map((l) => `- ${l.pieceKind}${l.platform ? ` for ${l.platform}` : ""}: "${clip(l.before, 240)}" became "${clip(l.after, 240)}"`)
          .join("\n"),
    );
  }
  return parts.join("\n\n");
}

/** The show's Vision as a short brief: what it is, mission, pillars. */
export function compassBrief(compass: Record<string, unknown> | null): { text: string; pillars: string[] } {
  if (!compass) return { text: "No Vision written for this show yet.", pillars: [] };
  const str = (k: string) => (typeof compass[k] === "string" ? (compass[k] as string) : "");
  const pillars = Array.isArray(compass.pillars) ? compass.pillars.filter((p): p is string => typeof p === "string") : [];
  const lines = [
    str("whatItIs") && `What the show is: ${str("whatItIs")}`,
    str("mission") && `Mission: ${str("mission")}`,
    str("howYouSeeIt") && `How it feels: ${str("howYouSeeIt")}`,
    pillars.length ? `Content pillars: ${pillars.join("; ")}` : "",
  ].filter(Boolean);
  return { text: lines.join("\n"), pillars };
}
