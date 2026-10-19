import { z } from "zod";
import { HexColour } from "./brand";

/** Lowercase, dash-separated, no leading or trailing dash. Used in URLs and as a saved name. */
export const Slug = z
  .string()
  .min(2, "Needs at least two characters")
  .max(60, "Keep it under sixty characters")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes");

export const StyleKind = z.enum(["video", "image", "motion", "voice"]);
export type StyleKind = z.infer<typeof StyleKind>;

export const Aspect = z.enum(["16:9", "9:16", "1:1", "4:5"]);
export const Pace = z.enum(["slow", "steady", "quick"]);

/**
 * The structured half of a style: settings a render step can act on without
 * reading English. Everything here is optional, because a style can be nothing
 * but a well-written instruction.
 */
export const StyleRecipe = z.object({
  version: z.number().int().positive().default(1),
  /** When to reach for it. The one field that makes a style findable months later. */
  useWhen: z.string().max(280).default(""),
  aspect: Aspect.optional(),
  pace: Pace.optional(),
  palette: z.array(HexColour).max(6).default([]),
  captions: z
    .object({
      on: z.boolean().default(true),
      position: z.enum(["top", "middle", "bottom"]).default("bottom"),
    })
    .optional(),
  /** Why this style exists, in the creator's words. Never invented by the system. */
  references: z
    .array(z.object({ note: z.string().min(1), url: z.string().url().optional() }))
    .max(8)
    .default([]),
});
export type StyleRecipe = z.infer<typeof StyleRecipe>;

/**
 * A saved, reusable style — "how I open an episode", "my hook look". Saved once
 * and applied by name in Review and Clip Studio, the way a person reuses a habit.
 */
export const StyleDoc = z.object({
  slug: Slug,
  name: z.string().min(1, "Give it a name you will recognise").max(80),
  kind: StyleKind,
  /** The instruction itself, in plain words. */
  prompt: z.string().min(1, "Say what the style actually is"),
  neverDo: z.array(z.string().min(1)).max(12).default([]),
  recipe: StyleRecipe,
});
export type StyleDoc = z.infer<typeof StyleDoc>;
