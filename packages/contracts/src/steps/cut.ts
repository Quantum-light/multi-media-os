import { z } from "zod";
import { defineStep } from "../pipeline";
import { TranscribeOutput } from "./transcribe";

export const CutReason = z.enum(["silence", "filler", "false_start", "retake"]);
export type CutReason = z.infer<typeof CutReason>;

/** One proposed removal on the source timeline. Nothing is re-encoded until render. */
export const Cut = z
  .object({
    startS: z.number().min(0),
    endS: z.number().positive(),
    reason: CutReason,
    /** What is removed, so a person can judge it at Review ("" for silence). */
    text: z.string(),
  })
  .refine((c) => c.endS > c.startS, { message: "a cut must end after it starts" });
export type Cut = z.infer<typeof Cut>;

export const CutInput = TranscribeOutput;

export const CutOutput = z.object({
  transcriptKey: z.string().min(1),
  durationS: z.number().positive(),
  /** Sorted, never overlapping. */
  cuts: z.array(Cut),
  removedS: z.number().min(0),
  keptS: z.number().positive(),
});
export type CutOutput = z.infer<typeof CutOutput>;

/** Proposes removals (silences, fillers, false starts, retakes) as a cut list. See specs/steps/cut.md. */
export const cut = defineStep({ name: "cut", input: CutInput, output: CutOutput });

type Span = { startS: number; endS: number };

/** Where a moment on the source recording lands once the cuts are applied. */
export function toEditedTime(sourceS: number, cuts: readonly Span[]): number {
  let removed = 0;
  for (const c of cuts) {
    if (c.endS <= sourceS) removed += c.endS - c.startS;
    else if (c.startS < sourceS) removed += sourceS - c.startS;
  }
  return Math.max(0, sourceS - removed);
}

/** True when a source time falls inside a removed span. */
export function isRemoved(sourceS: number, cuts: readonly Span[]): boolean {
  return cuts.some((c) => sourceS >= c.startS && sourceS < c.endS);
}
