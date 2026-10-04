const MiB = 1024 * 1024;

/** R2 and S3 limits for multipart uploads. Every part but the last must be the same size. */
export const MULTIPART = {
  minPartBytes: 5 * MiB,
  maxParts: 10_000,
  preferredPartBytes: 16 * MiB,
  maxObjectBytes: 4.995 * 1024 * 1024 * MiB,
} as const;

export type PartPlan = { partSize: number; partCount: number };

/**
 * Splits a file into equal parts: 16 MiB by default (fast to retry, enough to keep
 * the connection busy), grown in whole MiB only when a file would need over 10,000 parts.
 */
export function planParts(sizeBytes: number): PartPlan {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) throw new Error("File is empty");
  if (sizeBytes > MULTIPART.maxObjectBytes) throw new Error("File is larger than storage allows (about 5 TB)");
  const needed = Math.ceil(sizeBytes / MULTIPART.maxParts / MiB) * MiB;
  const partSize = Math.max(MULTIPART.preferredPartBytes, needed, MULTIPART.minPartBytes);
  return { partSize, partCount: Math.max(1, Math.ceil(sizeBytes / partSize)) };
}

/** Byte range [start, end) of a 1-based part number. */
export function partRange(partNumber: number, plan: PartPlan, sizeBytes: number): { start: number; end: number } {
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > plan.partCount) throw new Error(`No part ${partNumber}`);
  const start = (partNumber - 1) * plan.partSize;
  return { start, end: Math.min(start + plan.partSize, sizeBytes) };
}
