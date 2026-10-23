import { z } from "zod";

/**
 * What makes a moment worth cutting into a short. Grace chose these four, so the
 * finder hunts for them rather than for "engagement" in the abstract.
 */
export const ClipSignal = z.enum([
  /** Makes sense with no context around it. */
  "standalone_idea",
  /** The first sentence would stop a scroll. */
  "opening_line",
  /** Cuts against what people assume. */
  "surprising",
  /** Candid, funny, or from her own life. */
  "personal",
]);
export type ClipSignal = z.infer<typeof ClipSignal>;

export const ClipCandidate = z
  .object({
    startS: z.number().min(0),
    endS: z.number().min(0),
    signal: ClipSignal,
    /** 0–100. Only meaningful against other candidates from the same episode. */
    score: z.number().min(0).max(100),
    /** The first line out of her mouth in this clip, word for word. */
    hook: z.string().min(1),
    /** What was said, so a person can judge it without opening the video. */
    quote: z.string().min(1),
    /** One sentence on why it clears the bar. Shown in Clip Studio. */
    reason: z.string().min(1),
  })
  .refine((c) => c.endS > c.startS, { message: "A clip has to end after it starts" });
export type ClipCandidate = z.infer<typeof ClipCandidate>;

/**
 * The finder's answer for one episode: the ones to cut, in order, and everything
 * else that cleared the bar, kept so a person can pull one up instead of
 * re-running the search.
 */
export const ClipPlan = z.object({
  version: z.literal(1).default(1),
  /** How many this show wants per episode (21 for Human Time, 9–12 for the podcast). */
  target: z.number().int().positive(),
  chosen: z.array(ClipCandidate),
  reserve: z.array(ClipCandidate),
  /** How far short of the target the episode fell. Said out loud rather than padded. */
  shortfall: z.number().int().min(0),
});
export type ClipPlan = z.infer<typeof ClipPlan>;

/** Where a clip stands once a person has looked at it. */
export const ClipState = z.enum(["chosen", "reserve", "approved", "rejected"]);
export type ClipState = z.infer<typeof ClipState>;
