import { z } from "zod";
import { defineStep } from "../pipeline";
import { IngestOutput } from "./ingest";

/** One spoken word with its timing on the source recording (milliseconds). */
export const Word = z.object({
  text: z.string().min(1),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
  speaker: z.string().min(1).nullable(),
});
export type Word = z.infer<typeof Word>;

export const Utterance = z.object({
  speaker: z.string().min(1),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  text: z.string(),
});
export type Utterance = z.infer<typeof Utterance>;

/** The full transcript document, stored as JSON in object storage next to the audio. */
export const TranscriptDoc = z.object({
  version: z.literal(1),
  provider: z.literal("assemblyai"),
  providerRef: z.string().min(1),
  language: z.string().min(2),
  durationS: z.number().positive(),
  words: z.array(Word),
  utterances: z.array(Utterance),
});
export type TranscriptDoc = z.infer<typeof TranscriptDoc>;

/** Transcribe takes exactly what ingest made; only the small audio file is sent out. */
export const TranscribeInput = IngestOutput;

export const TranscribeOutput = z.object({
  transcriptKey: z.string().min(1),
  provider: z.literal("assemblyai"),
  providerRef: z.string().min(1),
  language: z.string().min(2),
  durationS: z.number().positive(),
  wordCount: z.number().int().min(0),
  speakers: z.array(z.string().min(1)),
  /** Plain text for search and Review; timings live in the transcript document. */
  text: z.string(),
});
export type TranscribeOutput = z.infer<typeof TranscribeOutput>;

/** Speech to text with speaker labels and word timings. See specs/steps/transcribe.md. */
export const transcribe = defineStep({ name: "transcribe", input: TranscribeInput, output: TranscribeOutput });
