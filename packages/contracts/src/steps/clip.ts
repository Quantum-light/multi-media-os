import { z } from "zod";
import { defineStep } from "../pipeline";
import { MomentKind } from "./understand";
import { WriteOutput } from "./write";

/** A short-form candidate on the source timeline, built from a moment the creator said. */
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

export const ClipInput = WriteOutput;
export const ClipOutput = z.object({ clips: z.array(ClipCandidate).max(8) });
export type ClipOutput = z.infer<typeof ClipOutput>;

/** Picks short-form candidates from the moments. Video shows only. See specs/steps/clip.md. */
export const clip = defineStep({ name: "clip", input: ClipInput, output: ClipOutput });
