import { z } from "zod";
import { ScoredClip } from "../clip";
import { defineStep } from "../pipeline";
import { MomentKind } from "./understand";
import { WriteOutput } from "./write";

/**
 * A short-form candidate on the source timeline, built from a moment the creator said.
 * The clip step no longer speaks in these: it works in `ScoredClip`, which carries the
 * signal and the judgement. Kept for the deterministic planner in the edit package.
 */
export const ClipCandidate = z
  .object({
    startS: z.number().min(0),
    endS: z.number().positive(),
    kind: MomentKind,
    title: z.string().min(1).max(100),
    quote: z.string().min(1),
  })
  .refine((c) => c.endS - c.startS >= 15 && c.endS - c.startS <= 90, { message: "a clip runs 15 to 90 seconds" });
export type ClipCandidate = z.infer<typeof ClipCandidate>;

/**
 * What the model hands back: candidates against Grace's four signals, each scored, with
 * her opening line word for word. More are asked for than the show wants, because
 * selection drops overlapping cuts of one moment and anything under the bar.
 */
export const ClipProposal = z.object({ candidates: z.array(ScoredClip).max(60) });
export type ClipProposal = z.infer<typeof ClipProposal>;

export const ClipInput = WriteOutput;

/**
 * The slate itself lives in public.clips, one row per clip against this job. The step's
 * result is only the shape of it, so Review can say "19 of the 21 wanted" without
 * carrying the whole slate through the job queue.
 */
export const ClipOutput = z.object({
  /** How many this show wants per episode. */
  target: z.number().int().positive(),
  /** How many the model offered, before selection. */
  proposed: z.number().int().min(0),
  chosen: z.number().int().min(0),
  reserve: z.number().int().min(0),
  /** How far short of the target the episode fell. Said out loud rather than padded. */
  shortfall: z.number().int().min(0),
  model: z.string().min(1),
});
export type ClipOutput = z.infer<typeof ClipOutput>;

/**
 * Finds the shorts: the model proposes, selection decides. Video shows only for now
 * (`VIDEO_ONLY_STEPS` in pipeline.ts), though the step already knows a podcast's
 * smaller target. See specs/steps/clip.md.
 */
export const clip = defineStep({ name: "clip", input: ClipInput, output: ClipOutput });
