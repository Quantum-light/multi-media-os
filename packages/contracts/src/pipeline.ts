import { z } from "zod";

/** The 11 steps every episode runs through. Podcasts skip the video-only ones. */
export const StepName = z.enum([
  "ingest",
  "transcribe",
  "cut",
  "understand",
  "write",
  "clip",
  "storyboard",
  "compose",
  "render",
  "review",
  "publish",
]);
export type StepName = z.infer<typeof StepName>;

export const VIDEO_ONLY_STEPS: ReadonlySet<StepName> = new Set(["clip", "storyboard"]);

export const JobStatus = z.enum(["queued", "running", "succeeded", "failed", "cancelled"]);

export const Job = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  episodeId: z.string().uuid(),
  step: StepName,
  /** Same input hash means same result: the engine returns the saved output instead of redoing work. */
  inputHash: z.string().min(16),
  status: JobStatus,
  attempts: z.number().int().min(0),
  leaseUntil: z.string().datetime().nullable(),
  error: z.string().nullable(),
});
export type Job = z.infer<typeof Job>;

/**
 * Every pipeline step has the same shape (anti-clunk rule 3).
 * A step is a name plus the schemas of what goes in and what comes out.
 */
export function defineStep<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(def: {
  name: StepName;
  input: I;
  output: O;
  videoOnly?: boolean;
}) {
  return Object.freeze({ ...def, videoOnly: def.videoOnly ?? VIDEO_ONLY_STEPS.has(def.name) });
}

export function stepsFor(kind: "podcast" | "video" | "both"): StepName[] {
  const all = StepName.options;
  return kind === "podcast" ? all.filter((s) => !VIDEO_ONLY_STEPS.has(s)) : [...all];
}
