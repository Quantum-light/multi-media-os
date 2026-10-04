import { describe, expect, it } from "vitest";
import { uploadService, UploadError, type UploadDb } from "./service";
import type { ObjectStore } from "./store";

const MiB = 1024 * 1024;
const WS = "11111111-1111-1111-1111-111111111111";

function fakes(opts: { duplicate?: boolean; storedBytes?: number | "match"; failCreateUpload?: boolean } = {}) {
  const calls: string[] = [];
  const assets = new Map<string, { id: string; workspaceId: string; episodeId: string; key: string; bytes: number }>();
  const episodes = new Set<string>();
  const db: UploadDb = {
    async showWorkspace(showId) { return showId === "show-1" ? WS : null; },
    async findDuplicate() { return opts.duplicate ? { episodeId: "old-ep", title: "Ep 1", createdAt: "2026-09-01T00:00:00Z" } : null; },
    async createEpisode() { episodes.add("ep-1"); calls.push("createEpisode"); return "ep-1"; },
    async createSourceAsset(input) {
      assets.set("asset-1", { id: "asset-1", workspaceId: input.workspaceId, episodeId: input.episodeId, key: input.key, bytes: input.bytes });
      return "asset-1";
    },
    async getAsset(id) { return assets.get(id) ?? null; },
    async startIngest(ep) { calls.push(`startIngest:${ep}`); },
    async discardEpisode(ep) { episodes.delete(ep); calls.push(`discard:${ep}`); },
  };
  const store: ObjectStore = {
    async createUpload() { if (opts.failCreateUpload) throw new Error("R2 down"); return "upload-1"; },
    async signPart(key, uploadId, n) { return `https://r2.example/${key}?uploadId=${uploadId}&part=${n}`; },
    async listParts() { return [{ partNumber: 1, etag: '"a"' }]; },
    async complete() { calls.push("complete"); },
    async abort() { calls.push("abort"); },
    async size(key) {
      const a = [...assets.values()].find((x) => x.key === key);
      return opts.storedBytes === undefined || opts.storedBytes === "match" ? (a?.bytes ?? null) : opts.storedBytes;
    },
  };
  return { svc: uploadService(db, store), calls, episodes };
}

const start = { showId: "show-1", fileName: "Raw take 3.mp4", sizeBytes: 40 * MiB, contentType: "video/mp4", quickFingerprint: "qf1:x", allowDuplicate: false };

describe("upload service", () => {
  it("starts an upload with a workspace-scoped key and a part plan", async () => {
    const { svc } = fakes();
    const s = await svc.start(start);
    expect(s).toEqual({ episodeId: "ep-1", assetId: "asset-1", uploadId: "upload-1", plan: { partSize: 16 * MiB, partCount: 3 } });
    const urls = await svc.sign("asset-1", "upload-1", [1, 3]);
    expect(urls[3]).toContain(`ws/${WS}/episodes/ep-1/source/Raw-take-3.mp4`);
  });

  it("refuses files that are not video or audio, and unknown shows", async () => {
    const { svc } = fakes();
    await expect(svc.start({ ...start, contentType: "application/pdf" })).rejects.toMatchObject({ status: 415 });
    await expect(svc.start({ ...start, showId: "other" })).rejects.toMatchObject({ status: 404 });
  });

  it("stops a duplicate before any bytes move, unless the person says go ahead", async () => {
    const { svc, calls } = fakes({ duplicate: true });
    const err = await svc.start(start).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UploadError);
    expect(err).toMatchObject({ status: 409, code: "duplicate_recording", detail: { episodeId: "old-ep" } });
    expect(calls).not.toContain("createEpisode");
    await expect(svc.start({ ...start, allowDuplicate: true })).resolves.toMatchObject({ episodeId: "ep-1" });
  });

  it("removes the episode again if storage will not start the upload", async () => {
    const { svc, calls, episodes } = fakes({ failCreateUpload: true });
    await expect(svc.start(start)).rejects.toThrow("R2 down");
    expect(calls).toContain("discard:ep-1");
    expect(episodes.size).toBe(0);
  });

  it("signs only real part numbers of a known asset", async () => {
    const { svc } = fakes();
    await svc.start(start);
    await expect(svc.sign("asset-1", "upload-1", [4])).rejects.toMatchObject({ status: 400 });
    await expect(svc.sign("asset-1", "upload-1", [])).rejects.toMatchObject({ status: 400 });
    await expect(svc.sign("nope", "upload-1", [1])).rejects.toMatchObject({ status: 404 });
  });

  it("completes only with every part, checks the size, then starts ingest", async () => {
    const { svc, calls } = fakes();
    await svc.start(start);
    const parts = [1, 2, 3].map((n) => ({ partNumber: n, etag: `"e${n}"` }));
    await expect(svc.complete("asset-1", "upload-1", parts.slice(0, 2))).rejects.toMatchObject({ code: "missing_parts" });
    await expect(svc.complete("asset-1", "upload-1", parts)).resolves.toEqual({ episodeId: "ep-1" });
    expect(calls.slice(-2)).toEqual(["complete", "startIngest:ep-1"]);
  });

  it("does not start ingest when storage holds the wrong size", async () => {
    const { svc, calls } = fakes({ storedBytes: 1 });
    await svc.start(start);
    const parts = [1, 2, 3].map((n) => ({ partNumber: n, etag: `"e${n}"` }));
    await expect(svc.complete("asset-1", "upload-1", parts)).rejects.toMatchObject({ code: "size_mismatch" });
    expect(calls).not.toContain("startIngest:ep-1");
  });

  it("abort cleans up storage and the episode", async () => {
    const { svc, calls } = fakes();
    await svc.start(start);
    await svc.abort("asset-1", "upload-1");
    expect(calls).toEqual(expect.arrayContaining(["abort", "discard:ep-1"]));
  });
});
