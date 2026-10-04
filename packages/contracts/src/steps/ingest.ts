import { z } from "zod";
import { defineStep } from "../pipeline";

export const IngestInput = z.object({
  assetId: z.string().uuid(),
  key: z.string().min(1),
  bytes: z.number().int().positive(),
});

export const IngestOutput = z.object({
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  durationS: z.number().positive(),
  video: z.object({ width: z.number().int().positive(), height: z.number().int().positive(), fps: z.number().positive() }).nullable(),
  audioKey: z.string().min(1),
  proxyKey: z.string().min(1).nullable(),
});

/** Reads the uploaded source once and derives the audio and preview later steps use. See specs/steps/ingest.md. */
export const ingest = defineStep({ name: "ingest", input: IngestInput, output: IngestOutput });
