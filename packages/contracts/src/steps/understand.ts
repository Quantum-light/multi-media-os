import { z } from "zod";
import { defineStep } from "../pipeline";
import { CutOutput } from "./cut";

export const MomentKind = z.enum(["story", "claim", "teaching", "practice", "question"]);
export type MomentKind = z.infer<typeof MomentKind>;

/** All times are on the source recording; write moves them onto the edited timeline. */
export const Chapter = z.object({ startS: z.number().min(0), title: z.string().min(1).max(80) });
export type Chapter = z.infer<typeof Chapter>;

export const Moment = z
  .object({
    startS: z.number().min(0),
    endS: z.number().positive(),
    kind: MomentKind,
    /** The creator's own words, quoted from the transcript. */
    quote: z.string().min(1).max(600),
    why: z.string().min(1).max(300),
  })
  .refine((m) => m.endS > m.startS, { message: "a moment must end after it starts" });
export type Moment = z.infer<typeof Moment>;

export const ThemeRef = z.object({
  name: z.string().min(1).max(60),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60),
});

export const PillarMatch = z.object({
  pillar: z.string().min(1),
  score: z.number().min(0).max(1),
  evidence: z.string().min(1).max(300),
});

/** What the model returns; checked before anything is saved. */
export const Understanding = z.object({
  summary: z.string().min(1).max(1200),
  chapters: z.array(Chapter).min(1).max(30),
  moments: z.array(Moment).max(40),
  themes: z.array(ThemeRef).min(1).max(8),
  pillars: z.array(PillarMatch).max(6),
});
export type Understanding = z.infer<typeof Understanding>;

export const UnderstandInput = CutOutput;

export const UnderstandOutput = Understanding.extend({
  transcriptKey: z.string().min(1),
  durationS: z.number().positive(),
  model: z.string().min(1),
});
export type UnderstandOutput = z.infer<typeof UnderstandOutput>;

/** Chapters, moments, themes and pillar matches against the show's Vision. See specs/steps/understand.md. */
export const understand = defineStep({ name: "understand", input: UnderstandInput, output: UnderstandOutput });
