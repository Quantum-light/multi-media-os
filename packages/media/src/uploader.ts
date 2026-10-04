import { partRange, type PartPlan } from "./plan";

/** How the uploader reaches storage. The Studio's version calls its own API and PUTs to signed URLs. */
export type UploadTransport = {
  /** Signed PUT URLs for the given part numbers. */
  signParts(partNumbers: number[]): Promise<Record<number, string>>;
  /** Uploads one part and returns its ETag. Reports bytes sent so far for that part. */
  putPart(url: string, body: Blob, onProgress: (sentBytes: number) => void, signal: AbortSignal): Promise<string>;
};

export type UploadProgress = { sentBytes: number; totalBytes: number; partsDone: number; partCount: number };
export type CompletedPart = { partNumber: number; etag: string };

export type UploadOptions = {
  /** Parts in flight at once. Six keeps a home connection full without starving it. */
  concurrency?: number;
  /** Attempts per part before the whole upload stops. */
  maxAttempts?: number;
  /** Parts already uploaded (from an earlier, interrupted run): number → ETag. */
  done?: ReadonlyMap<number, string>;
  onProgress?: (progress: UploadProgress) => void;
  /** Called as each part lands, so a resume record can be saved. */
  onPartDone?: (part: CompletedPart) => void;
  signal?: AbortSignal;
  /** Injected for tests; waits between retries. */
  sleep?: (ms: number) => Promise<void>;
};

const SIGN_BATCH = 24;

/** Uploads every missing part in parallel with retries, and returns all parts in order. */
export async function uploadParts(file: Blob, plan: PartPlan, transport: UploadTransport, options: UploadOptions = {}): Promise<CompletedPart[]> {
  const concurrency = Math.max(1, options.concurrency ?? 6);
  const maxAttempts = Math.max(1, options.maxAttempts ?? 5);
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const abort = new AbortController();
  options.signal?.addEventListener("abort", () => abort.abort(), { once: true });
  if (options.signal?.aborted) abort.abort();

  const etags = new Map<number, string>(options.done ?? []);
  const inFlight = new Map<number, number>();
  const sizeOf = (n: number) => {
    const r = partRange(n, plan, file.size);
    return r.end - r.start;
  };
  let doneBytes = [...etags.keys()].reduce((sum, n) => sum + sizeOf(n), 0);

  const report = () =>
    options.onProgress?.({
      sentBytes: doneBytes + [...inFlight.values()].reduce((a, b) => a + b, 0),
      totalBytes: file.size,
      partsDone: etags.size,
      partCount: plan.partCount,
    });

  const queue = Array.from({ length: plan.partCount }, (_, i) => i + 1).filter((n) => !etags.has(n));
  const urls = new Map<number, string>();

  let signing: Promise<void> | null = null;
  const store = (signed: Record<number, string>) => {
    for (const [k, v] of Object.entries(signed)) urls.set(Number(k), v);
  };

  /** Signed URL for a part. Workers share one signing call per batch; a retry asks for a fresh one. */
  const urlFor = async (n: number, fresh: boolean): Promise<string> => {
    if (fresh) {
      store(await transport.signParts([n]));
    }
    while (!urls.has(n)) {
      if (signing) {
        await signing;
        continue;
      }
      const batch = [n, ...queue.filter((p) => !urls.has(p))].slice(0, SIGN_BATCH);
      signing = transport.signParts(batch).then(store).finally(() => {
        signing = null;
      });
      await signing;
      if (!urls.has(n)) throw new Error(`Storage did not sign part ${n}`);
    }
    return urls.get(n)!;
  };

  const sendPart = async (n: number): Promise<void> => {
    const { start, end } = partRange(n, plan, file.size);
    const body = file.slice(start, end);
    for (let attempt = 1; ; attempt++) {
      if (abort.signal.aborted) throw abortError();
      try {
        const url = await urlFor(n, attempt > 1);
        const etag = await transport.putPart(url, body, (sent) => { inFlight.set(n, sent); report(); }, abort.signal);
        inFlight.delete(n);
        etags.set(n, etag);
        doneBytes += end - start;
        options.onPartDone?.({ partNumber: n, etag });
        report();
        return;
      } catch (error) {
        inFlight.delete(n);
        if (abort.signal.aborted) throw abortError();
        if (attempt >= maxAttempts) throw new Error(`Part ${n} failed after ${maxAttempts} tries: ${error instanceof Error ? error.message : String(error)}`);
        await sleep(Math.min(500 * 2 ** (attempt - 1), 8000));
      }
    }
  };

  const worker = async () => {
    for (let n = queue.shift(); n !== undefined; n = queue.shift()) await sendPart(n);
  };

  report();
  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, worker));
  } catch (error) {
    abort.abort();
    throw error;
  }
  return [...etags].sort(([a], [b]) => a - b).map(([partNumber, etag]) => ({ partNumber, etag }));
}

function abortError(): Error {
  const e = new Error("Upload cancelled");
  e.name = "AbortError";
  return e;
}
