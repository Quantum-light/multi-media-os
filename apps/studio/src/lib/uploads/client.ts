import { quickFingerprint, uploadParts, type CompletedPart, type PartPlan, type UploadProgress, type UploadTransport } from "@mmos/media";
import type { StartReply } from "./schemas";

export type Duplicate = { episodeId: string; title: string | null; createdAt: string };
export type UploadOutcome = { kind: "done"; episodeId: string } | { kind: "duplicate"; existing: Duplicate };
export type UploadStage = "checking" | "uploading" | "finishing";

export class ApiFailure extends Error {
  constructor(readonly code: string, message: string, readonly detail?: unknown) {
    super(message);
  }
}

async function api<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { code?: string; message?: string; detail?: unknown };
  if (!res.ok) throw new ApiFailure(json.code ?? "error", json.message ?? `Request failed (${res.status})`, json.detail);
  return json as T;
}

type ResumeRecord = { assetId: string; uploadId: string; episodeId: string; plan: PartPlan; size: number; showId: string };
const resumeKey = (fp: string) => `mmos-upload:${fp}`;

function readResume(fp: string, size: number, showId: string): ResumeRecord | null {
  try {
    const rec = JSON.parse(localStorage.getItem(resumeKey(fp)) ?? "null") as ResumeRecord | null;
    return rec && rec.size === size && rec.showId === showId ? rec : null;
  } catch {
    return null;
  }
}
function writeResume(fp: string, rec: ResumeRecord) {
  try { localStorage.setItem(resumeKey(fp), JSON.stringify(rec)); } catch { /* resume is a convenience */ }
}
function clearResume(fp: string) {
  try { localStorage.removeItem(resumeKey(fp)); } catch { /* nothing to clear */ }
}

/** PUTs one part straight to storage, reporting progress. Needs the bucket to expose the ETag header (CORS). */
function putPart(url: string, body: Blob, onProgress: (sent: number) => void, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      const etag = xhr.getResponseHeader("ETag");
      if (xhr.status >= 200 && xhr.status < 300 && etag) resolve(etag);
      else if (xhr.status >= 200 && xhr.status < 300) reject(new Error("Storage did not return the part's ETag (check the bucket's CORS settings)"));
      else reject(new Error(`Storage answered ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Timed out"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.onabort = () => reject(new Error("aborted"));
    xhr.send(body);
  });
}

type Options = {
  allowDuplicate?: boolean;
  onStage?: (stage: UploadStage) => void;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
};

/**
 * The whole upload from the browser: fingerprint, duplicate check, parallel parts straight to
 * R2, then completion. An interrupted upload of the same file to the same show resumes.
 */
export async function uploadRecording(file: File, showId: string, options: Options = {}): Promise<UploadOutcome> {
  options.onStage?.("checking");
  const fp = await quickFingerprint(file);

  let rec = readResume(fp, file.size, showId);
  let done = new Map<number, string>();
  if (rec) {
    try {
      const { parts } = await api<{ parts: CompletedPart[] }>("/api/uploads/parts", { assetId: rec.assetId, uploadId: rec.uploadId });
      done = new Map(parts.map((p) => [p.partNumber, p.etag]));
    } catch {
      clearResume(fp);
      rec = null;
    }
  }

  if (!rec) {
    try {
      const started = await api<StartReply>("/api/uploads", {
        showId,
        fileName: file.name,
        sizeBytes: file.size,
        contentType: file.type || "application/octet-stream",
        quickFingerprint: fp,
        allowDuplicate: options.allowDuplicate ?? false,
      });
      rec = { ...started, size: file.size, showId };
      writeResume(fp, rec);
    } catch (error) {
      if (error instanceof ApiFailure && error.code === "duplicate_recording") return { kind: "duplicate", existing: error.detail as Duplicate };
      throw error;
    }
  }

  const { assetId, uploadId } = rec;
  const transport: UploadTransport = {
    signParts: (partNumbers) => api<Record<number, string>>("/api/uploads/sign", { assetId, uploadId, partNumbers }),
    putPart,
  };

  options.onStage?.("uploading");
  let parts: CompletedPart[];
  try {
    parts = await uploadParts(file, rec.plan, transport, {
      done,
      ...(options.onProgress ? { onProgress: options.onProgress } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if (options.signal?.aborted) {
      clearResume(fp);
      await api("/api/uploads/abort", { assetId, uploadId }).catch(() => undefined);
    }
    throw error;
  }

  options.onStage?.("finishing");
  const result = await api<{ episodeId: string }>("/api/uploads/complete", { assetId, uploadId, parts });
  clearResume(fp);
  return { kind: "done", episodeId: result.episodeId };
}
