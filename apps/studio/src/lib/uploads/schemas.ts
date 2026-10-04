import { z } from "zod";

const Uuid = z.string().uuid();
const UploadId = z.string().min(1).max(1024);
const Part = z.object({ partNumber: z.number().int().min(1).max(10_000), etag: z.string().min(1).max(200) });

export const StartBody = z.object({
  showId: Uuid,
  fileName: z.string().min(1).max(400),
  sizeBytes: z.number().int().positive(),
  contentType: z.string().min(1).max(200),
  quickFingerprint: z.string().regex(/^qf1:[0-9a-f]{64}$/),
  allowDuplicate: z.boolean().default(false),
});
export const SignBody = z.object({ assetId: Uuid, uploadId: UploadId, partNumbers: z.array(z.number().int()).min(1).max(100) });
export const RefBody = z.object({ assetId: Uuid, uploadId: UploadId });
export const CompleteBody = RefBody.extend({ parts: z.array(Part).min(1).max(10_000) });

/** Shapes the browser receives. */
export type StartReply = { episodeId: string; assetId: string; uploadId: string; plan: { partSize: number; partCount: number } };
export type ApiError = { code: string; message: string; detail?: unknown };
