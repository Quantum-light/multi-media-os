import type { Json } from "@mmos/db";
import { z } from "zod";

/**
 * One record of a correction.
 *
 * Every correction a person makes in Review — a cut moved, a title rewritten, a
 * clip swapped, a graphic changed, a post moved — is one row of
 * `public.style_edits`, recorded against the style that produced the thing. The
 * vocabulary of subjects lives in that table's check constraint; this mirrors it
 * for the Studio, and a new kind of correction is added in both places and
 * nowhere else.
 *
 * This file shapes a correction. It writes nothing: the write goes through a
 * server action, which calls one definer function.
 */

export const SUBJECTS = ["cut", "copy", "clip", "graphic", "schedule"] as const;
export type Subject = (typeof SUBJECTS)[number];

/** A correction is kept as JSON in `public.style_edits`, so only JSON goes in. */
const JsonValue: z.ZodType<Json> = z.lazy(() => z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonValue), z.record(JsonValue)]));
const Shape = z.record(JsonValue);
export type Shape = Record<string, Json>;

export const CorrectionInput = z.object({
  episodeId: z.string().uuid(),
  subject: z.enum(SUBJECTS),
  /** What the system put forward. */
  proposed: Shape,
  /** What the person made it instead. */
  accepted: Shape,
  /** Their own words, when they gave them. */
  note: z.string().max(300).optional(),
});
export type CorrectionInput = z.infer<typeof CorrectionInput>;

/** The arguments of the one definer function that records a correction. */
export type CorrectionArgs = {
  p_episode: string;
  p_subject: Subject;
  p_proposed: Shape;
  p_accepted: Shape;
  p_note?: string;
};

/**
 * Checks a correction and shapes it for the record. Answers null when the
 * person changed nothing, so a no-op is never recorded as taste.
 */
export function correctionArgs(input: unknown): CorrectionArgs | null {
  const c = CorrectionInput.parse(input);
  if (same(c.proposed, c.accepted)) return null;
  const note = c.note?.trim();
  return {
    p_episode: c.episodeId,
    p_subject: c.subject,
    p_proposed: c.proposed,
    p_accepted: c.accepted,
    ...(note ? { p_note: note } : {}),
  };
}

/** The shape of a correction to written copy, the same way the record keeps it. */
export function copyShape(kind: string, platform: string, body: string): Shape {
  return { kind, platform, body };
}

/** Key order is not a change of taste, so compare by value. */
function same(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return stable(a) === stable(b);
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
}
