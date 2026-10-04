import { describe, expect, it } from "vitest";
import { planParts } from "./plan";
import { uploadParts, type UploadTransport } from "./uploader";

const MiB = 1024 * 1024;
const noWait = async () => {};

function fakeTransport(opts: { failTimes?: Record<number, number>; delayMs?: number } = {}) {
  const fails = { ...(opts.failTimes ?? {}) };
  let live = 0;
  const log = { maxLive: 0, signed: [] as number[][], puts: [] as number[] };
  const transport: UploadTransport = {
    async signParts(parts) {
      log.signed.push(parts);
      return Object.fromEntries(parts.map((p) => [p, `https://r2.example/part/${p}?sig=${log.signed.length}`]));
    },
    async putPart(url, body, onProgress, signal) {
      const n = Number(/part\/(\d+)/.exec(url)![1]);
      live += 1;
      log.maxLive = Math.max(log.maxLive, live);
      try {
        await new Promise((r) => setTimeout(r, opts.delayMs ?? 1));
        if (signal.aborted) throw new Error("aborted");
        if ((fails[n] ?? 0) > 0) {
          fails[n]! -= 1;
          throw new Error("network reset");
        }
        onProgress(body.size);
        log.puts.push(n);
        return `"etag-${n}"`;
      } finally {
        live -= 1;
      }
    },
  };
  return { transport, log };
}

const file = new Blob([new Uint8Array(100 * MiB)]); // 7 parts of 16 MiB
const plan = planParts(file.size);

describe("uploadParts", () => {
  it("uploads every part in parallel and returns them in order", async () => {
    const { transport, log } = fakeTransport({ delayMs: 5 });
    const seen: number[] = [];
    const parts = await uploadParts(file, plan, transport, { concurrency: 3, onProgress: (p) => seen.push(p.sentBytes), sleep: noWait });
    expect(parts.map((p) => p.partNumber)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(parts[0]!.etag).toBe('"etag-1"');
    expect(log.maxLive).toBe(3);
    expect(seen.at(-1)).toBe(file.size);
    expect(log.signed.length).toBe(1); // one signing call for the whole batch
  });

  it("retries a failing part with a freshly signed URL", async () => {
    const { transport, log } = fakeTransport({ failTimes: { 4: 2 } });
    const parts = await uploadParts(file, plan, transport, { sleep: noWait });
    expect(parts).toHaveLength(7);
    expect(log.signed.filter((s) => s.length === 1 && s[0] === 4)).toHaveLength(2);
  });

  it("stops with a clear error when a part keeps failing", async () => {
    const { transport } = fakeTransport({ failTimes: { 2: 99 } });
    await expect(uploadParts(file, plan, transport, { maxAttempts: 3, sleep: noWait })).rejects.toThrow(/Part 2 failed after 3 tries: network reset/);
  });

  it("resumes: only missing parts are sent", async () => {
    const { transport, log } = fakeTransport();
    const done = new Map([[1, '"etag-1"'], [2, '"etag-2"'], [5, '"etag-5"']]);
    const landed: number[] = [];
    const parts = await uploadParts(file, plan, transport, { done, onPartDone: (p) => landed.push(p.partNumber), sleep: noWait });
    expect(log.puts.sort()).toEqual([3, 4, 6, 7]);
    expect(landed.sort()).toEqual([3, 4, 6, 7]);
    expect(parts.map((p) => p.partNumber)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("can be cancelled", async () => {
    const { transport } = fakeTransport({ delayMs: 20 });
    const stop = new AbortController();
    const run = uploadParts(file, plan, transport, { signal: stop.signal, sleep: noWait });
    setTimeout(() => stop.abort(), 5);
    await expect(run).rejects.toThrow(/cancelled/);
  });
});
