import { Draft, TEXT_LIMITS, stamp, toEditedTime, youtubeChapters, type Cut, type Platform, type Understanding, type WriteOutput } from "@mmos/contracts";
import { costPence, type Llm, type Usage } from "./anthropic";
import { compassBrief, HUMAN_SOURCED, voiceBrief, type Lesson } from "./voice";

export type WriteShow = {
  showName: string;
  brandName: string;
  compass: Record<string, unknown> | null;
  voiceKit: unknown;
  voiceLessons: readonly Lesson[];
  platforms: readonly Platform[];
};

const PLATFORM_NOTES: Partial<Record<Platform, string>> = {
  youtube: "YouTube description lead: what the viewer gets, in the creator's terms (the full description is written separately, so this caption is the first two lines only).",
  instagram: "Instagram caption for the Reel: a hook line from their words, two or three short lines, a soft call to watch the full episode, at most five relevant hashtags at the end.",
  threads: "Threads post: one thought from the episode in their voice, conversational, no hashtags, under 500 characters.",
};

export function writePrompt(show: WriteShow, u: Understanding, chaptersText: string): { system: string; prompt: string } {
  const platforms = show.platforms.length ? show.platforms : (["youtube"] as Platform[]);
  const system = [
    `You write the published text for "${show.showName}" by ${show.brandName}, in the creator's own voice.`,
    HUMAN_SOURCED,
    voiceBrief(show.voiceKit, show.voiceLessons),
  ].join("\n\n");
  const prompt = [
    `Show Vision:\n${compassBrief(show.compass).text}`,
    `What the episode covers:\n${u.summary}`,
    `Chapters (already timed, do not change):\n${chaptersText || "(none)"}`,
    `Moments in the creator's words:\n${u.moments.map((m) => `- (${m.kind}) "${m.quote}"`).join("\n") || "(none)"}`,
    `Themes: ${u.themes.map((t) => t.name).join(", ")}`,
    "Write:",
    `- titleOptions: three YouTube titles, best first, each at most ${TEXT_LIMITS.title} characters. Specific and honest; curiosity is fine, clickbait and ALL CAPS are not.`,
    `- description: the YouTube description, at most 1500 characters, plain paragraphs: what the episode explores and why it matters to the viewer, using the creator's own phrases. Do not include the chapter list or links; they are added after.`,
    `- captions: exactly one per platform for ${platforms.join(", ")}.`,
    ...platforms.map((p) => `  - ${p}: ${PLATFORM_NOTES[p] ?? "A short caption in the creator's voice."} Max ${TEXT_LIMITS.caption[p]} characters.`),
  ].join("\n\n");
  return { system, prompt };
}

/** Chapters move from the source recording onto the edited timeline, then follow YouTube's rules. */
export function editedChapters(u: Pick<Understanding, "chapters">, cuts: readonly Cut[], editedDurationS: number) {
  const moved = u.chapters.map((c) => ({ atS: toEditedTime(c.startS, cuts), title: c.title }));
  const chapters = youtubeChapters(moved, editedDurationS);
  return { chapters, chaptersText: chapters.map((c) => `${stamp(c.atS)} ${c.title}`).join("\n") };
}

export async function runWrite(llm: Llm, show: WriteShow, u: Understanding, cuts: readonly Cut[], editedDurationS: number, signal?: AbortSignal): Promise<{ output: WriteOutput; usage: Usage; costPence: number }> {
  const { chapters, chaptersText } = editedChapters(u, cuts, editedDurationS);
  const { system, prompt } = writePrompt(show, u, chaptersText);
  const { data, usage } = await llm.structured({
    system,
    prompt,
    tool: { name: "save_drafts", description: "Save the drafts for this episode.", schema: Draft },
    maxTokens: 6000,
    ...(signal ? { signal } : {}),
  });
  const wanted = new Set(show.platforms.length ? show.platforms : ["youtube"]);
  const captions = data.captions.filter((c, i, all) => wanted.has(c.platform) && all.findIndex((x) => x.platform === c.platform) === i);
  const title = data.titleOptions[0]!;
  return {
    output: { title, titleOptions: data.titleOptions, description: data.description, chapters, chaptersText, captions, model: llm.model },
    usage,
    costPence: costPence(usage),
  };
}
