import { keyInWorkspace, planParts, sourceKey, type CompletedPart, type PartPlan } from "@mmos/media";
import type { ObjectStore } from "./store";

/** The database side of uploading. Every call runs as the signed-in person, so RLS decides. */
export type UploadDb = {
  showWorkspace(showId: string): Promise<string | null>;
  findDuplicate(workspaceId: string, quickFingerprint: string): Promise<{ episodeId: string; title: string | null; createdAt: string } | null>;
  createEpisode(workspaceId: string, showId: string, title: string): Promise<string>;
  createSourceAsset(input: { workspaceId: string; episodeId: string; key: string; bytes: number; quickFingerprint: string }): Promise<string>;
  getAsset(assetId: string): Promise<{ id: string; workspaceId: string; episodeId: string; key: string; bytes: number } | null>;
  startIngest(episodeId: string): Promise<void>;
  discardEpisode(episodeId: string): Promise<void>;
};

export class UploadError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly detail?: unknown) {
    super(message);
  }
}

export type StartInput = { showId: string; fileName: string; sizeBytes: number; contentType: string; quickFingerprint: string; allowDuplicate: boolean };
export type Started = { episodeId: string; assetId: string; uploadId: string; plan: PartPlan };

const MAX_SIGN = 100;

/** Upload flow: start → sign parts → complete (or abort). Pure orchestration, tested with fakes. */
export function uploadService(db: UploadDb, store: ObjectStore) {
  const ownedAsset = async (assetId: string) => {
    const asset = await db.getAsset(assetId);
    // RLS hides other workspaces' assets, so "not found" also covers "not yours".
    if (!asset || !keyInWorkspace(asset.key, asset.workspaceId)) throw new UploadError(404, "not_found", "That upload was not found.");
    return asset;
  };

  return {
    async start(input: StartInput): Promise<Started> {
      if (!/^(video|audio)\//.test(input.contentType)) throw new UploadError(415, "not_media", "Choose a video or audio recording.");
      const plan = planParts(input.sizeBytes);
      const workspaceId = await db.showWorkspace(input.showId);
      if (!workspaceId) throw new UploadError(404, "no_show", "That show was not found.");

      if (!input.allowDuplicate) {
        const dup = await db.findDuplicate(workspaceId, input.quickFingerprint);
        if (dup) throw new UploadError(409, "duplicate_recording", "This recording has been uploaded before.", dup);
      }

      const title = input.fileName.replace(/\.[^.]+$/, "").trim() || "New recording";
      const episodeId = await db.createEpisode(workspaceId, input.showId, title);
      try {
        const key = sourceKey(workspaceId, episodeId, input.fileName);
        const assetId = await db.createSourceAsset({ workspaceId, episodeId, key, bytes: input.sizeBytes, quickFingerprint: input.quickFingerprint });
        const uploadId = await store.createUpload(key, input.contentType);
        return { episodeId, assetId, uploadId, plan };
      } catch (error) {
        await db.discardEpisode(episodeId).catch(() => undefined);
        throw error;
      }
    },

    async sign(assetId: string, uploadId: string, partNumbers: number[]): Promise<Record<number, string>> {
      if (partNumbers.length === 0 || partNumbers.length > MAX_SIGN) throw new UploadError(400, "bad_parts", `Ask for 1 to ${MAX_SIGN} parts at a time.`);
      const asset = await ownedAsset(assetId);
      const { partCount } = planParts(asset.bytes);
      if (partNumbers.some((n) => !Number.isInteger(n) || n < 1 || n > partCount)) throw new UploadError(400, "bad_parts", "Part number out of range.");
      const urls = await Promise.all(partNumbers.map((n) => store.signPart(asset.key, uploadId, n)));
      return Object.fromEntries(partNumbers.map((n, i) => [n, urls[i]!]));
    },

    async parts(assetId: string, uploadId: string): Promise<CompletedPart[]> {
      const asset = await ownedAsset(assetId);
      return store.listParts(asset.key, uploadId);
    },

    async complete(assetId: string, uploadId: string, parts: CompletedPart[]): Promise<{ episodeId: string }> {
      const asset = await ownedAsset(assetId);
      const { partCount } = planParts(asset.bytes);
      const numbers = parts.map((p) => p.partNumber);
      const complete = numbers.length === partCount && numbers.every((n, i) => n === i + 1);
      if (!complete) throw new UploadError(400, "missing_parts", `Expected parts 1 to ${partCount} in order.`);

      await store.complete(asset.key, uploadId, parts);
      const stored = await store.size(asset.key);
      if (stored !== asset.bytes) {
        throw new UploadError(422, "size_mismatch", `Storage holds ${stored ?? 0} bytes but the file is ${asset.bytes}. Upload it again.`);
      }
      await db.startIngest(asset.episodeId);
      return { episodeId: asset.episodeId };
    },

    async abort(assetId: string, uploadId: string): Promise<void> {
      const asset = await ownedAsset(assetId);
      await store.abort(asset.key, uploadId).catch(() => undefined);
      await db.discardEpisode(asset.episodeId);
    },
  };
}

export type UploadService = ReturnType<typeof uploadService>;
