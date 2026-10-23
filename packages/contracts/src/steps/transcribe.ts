import { z } from "zod";
import { defineStep } from "../pipeline";

/**
 * Takes ingest's output, so the chain can hand one step's result straight to the
 * next. Only `audioKey` and `durationS` are read; the rest is ignored.
 */
export const TranscribeInput = z.object({
  audioKey: z.string().min(1),
  durationS: z.number().positive(),
  /** Left out means "work it out from the audio". */
  language: z.string().min(2).optional(),
});

export const TranscribeOutput = z.object({
  /** The transcript document in R2. Every later step reads it from here. */
  transcriptKey: z.string().min(1),
  /** Carried through so `cut` and `clip` need not fetch the asset row again. */
  durationS: z.number().positive(),
  language: z.string().min(2),
  segmentCount: z.number().int().positive(),
  wordCount: z.number().int().min(0),
  provider: z.string().min(1),
  model: z.string().min(1).nullable(),
});

/** Turns the small audio file ingest made into words with timings. */
export const transcribe = defineStep({ name: "transcribe", input: TranscribeInput, output: TranscribeOutput });
