import { z } from "zod";

/** A colour as #RRGGBB. Brand kits never store named colours or alpha. */
export const HexColour = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use #RRGGBB");

export const FontRef = z.object({
  family: z.string().min(1),
  source: z.enum(["google", "upload"]),
  /** Uploaded fonts must carry the creator's confirmation that they hold the licence. */
  licenceConfirmed: z.boolean().default(false),
});

export const MotionSignature = z.enum(["thread", "frame", "pulse"]);

export const Persona = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  /** Proof the persona is real: comments, messages, survey answers. Never invented. */
  evidence: z.array(z.object({ kind: z.string(), note: z.string(), url: z.string().url().optional() })).default([]),
});

export const BrandKit = z.object({
  version: z.number().int().positive(),
  story: z.string().min(1),
  styleWords: z.array(z.string()).default([]),
  fonts: z.object({ display: FontRef, base: FontRef }),
  colours: z.object({
    ground: HexColour,
    accent: HexColour,
    ink: HexColour,
    extra: z.array(HexColour).default([]),
  }),
  motion: MotionSignature,
  neverDo: z.array(z.string()).default([]),
  personas: z.array(Persona).max(3).default([]),
});
export type BrandKit = z.infer<typeof BrandKit>;

export const VoiceKit = z.object({
  version: z.number().int().positive(),
  rules: z.string().min(1),
  avoidTerms: z.array(z.string()).default([]),
  glossary: z.array(z.object({ find: z.array(z.string()), replace: z.string() })).default([]),
});
export type VoiceKit = z.infer<typeof VoiceKit>;
