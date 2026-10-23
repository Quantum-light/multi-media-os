import { z } from "zod";
import { Platform } from "../content";
import { defineStep } from "../pipeline";
import { UnderstandOutput } from "./understand";

/** Hard limits each platform enforces; drafts must fit before a person ever sees them. */
export const TEXT_LIMITS = {
  title: 100,
  description: 5000,
  caption: { youtube: 5000, youtube_shorts: 100, instagram: 2200, tiktok: 2200, threads: 500, x: 280, linkedin: 3000, podcast: 4000, newsletter: 10000, website: 10000 },
} as const;

export const Caption = z
  .object({ platform: Platform, body: z.string().min(1) })
  .refine((c) => c.body.length <= TEXT_LIMITS.caption[c.platform], { message: "caption is longer than the platform allows" });
export type Caption = z.infer<typeof Caption>;

/** Chapters on the edited timeline, as they will appear on YouTube. */
export const EditedChapter = z.object({ atS: z.number().min(0), title: z.string().min(1).max(80) });
export type EditedChapter = z.infer<typeof EditedChapter>;

/** What the model writes. */
export const Draft = z.object({
  titleOptions: z.array(z.string().min(1).max(TEXT_LIMITS.title)).min(2).max(5),
  description: z.string().min(1).max(TEXT_LIMITS.description),
  captions: z.array(Caption).min(1),
});
export type Draft = z.infer<typeof Draft>;

export const WriteInput = UnderstandOutput;

export const WriteOutput = z.object({
  title: z.string().min(1).max(TEXT_LIMITS.title),
  titleOptions: z.array(z.string().min(1).max(TEXT_LIMITS.title)).min(1),
  description: z.string().min(1).max(TEXT_LIMITS.description),
  chapters: z.array(EditedChapter),
  /** "0:00 Welcome" lines, ready to paste under a YouTube description. */
  chaptersText: z.string(),
  captions: z.array(Caption),
  model: z.string().min(1),
});
export type WriteOutput = z.infer<typeof WriteOutput>;

/** Titles, description, chapters and captions in the brand voice. See specs/steps/write.md. */
export const write = defineStep({ name: "write", input: WriteInput, output: WriteOutput });

/** YouTube timestamps: m:ss under an hour, h:mm:ss after. */
export function stamp(totalS: number): string {
  const s = Math.max(0, Math.floor(totalS));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/**
 * YouTube only shows chapters when the first starts at 0:00, there are at least three,
 * and each lasts ten seconds or more. Returns the cleaned list (possibly empty).
 */
export function youtubeChapters(chapters: readonly { atS: number; title: string }[], durationS: number): { atS: number; title: string }[] {
  const sorted = [...chapters].sort((a, b) => a.atS - b.atS);
  const kept: { atS: number; title: string }[] = [];
  for (const c of sorted) {
    const at = kept.length === 0 ? 0 : Math.floor(c.atS);
    const prev = kept[kept.length - 1];
    if (prev && at - prev.atS < 10) continue;
    if (durationS - at < 10) continue;
    kept.push({ atS: at, title: c.title.trim() });
  }
  return kept.length >= 3 ? kept : [];
}
