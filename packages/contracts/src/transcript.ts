import { z } from "zod";

/** One run of speech with its place in the recording. */
export const TranscriptSegment = z
  .object({
    startS: z.number().min(0),
    endS: z.number().min(0),
    text: z.string().min(1),
    /** Null until diarisation is turned on; never guessed. */
    speaker: z.string().min(1).nullable().default(null),
    confidence: z.number().min(0).max(1).nullable().default(null),
  })
  .refine((s) => s.endS > s.startS, { message: "A segment has to end after it starts" });
export type TranscriptSegment = z.infer<typeof TranscriptSegment>;

/**
 * What was said, with timings. Stored in R2 rather than in the job row: a long
 * episode runs to hundreds of kilobytes, and every later step reads it.
 */
export const Transcript = z
  .object({
    version: z.literal(1).default(1),
    language: z.string().min(2),
    durationS: z.number().positive(),
    /** Who produced it, so a re-run with a different engine is visible. */
    provider: z.string().min(1),
    model: z.string().min(1).nullable().default(null),
    segments: z.array(TranscriptSegment).min(1),
  })
  .refine((t) => isOrdered(t.segments), { message: "Segments have to be in the order they were spoken" });
export type Transcript = z.infer<typeof Transcript>;

function isOrdered(segments: { startS: number }[]): boolean {
  return segments.every((segment, i) => i === 0 || segment.startS >= (segments[i - 1]?.startS ?? 0));
}

/** The whole transcript as prose, for a step that wants to read rather than seek. */
export function transcriptText(transcript: Transcript): string {
  return transcript.segments.map((s) => s.text.trim()).join(" ");
}

/** The segments that overlap a window, in order. Used to quote a clip exactly. */
export function segmentsBetween(transcript: Transcript, startS: number, endS: number): TranscriptSegment[] {
  return transcript.segments.filter((s) => s.endS > startS && s.startS < endS);
}

export function wordCount(transcript: Transcript): number {
  return transcript.segments.reduce((total, s) => total + s.text.trim().split(/\s+/).filter(Boolean).length, 0);
}
