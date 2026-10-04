/**
 * Times the ingest step on a real-sized recording, using a local folder as storage.
 *   npx tsx scripts/bench-ingest.ts /path/to/recording.mp4
 * Network time to and from R2 is not included; this measures the work the worker does.
 */
import { mkdtemp, mkdir, rm, symlink, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { registry, runOnce } from "../src/runner";
import { folderStore } from "../src/storage";
import { ingestHandler } from "../src/steps/ingest";
import { MemoryQueue } from "../src/testing/memory-queue";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npx tsx scripts/bench-ingest.ts <recording>");
  process.exit(1);
}
const root = await mkdtemp(join(tmpdir(), "mmos-bench-"));
const store = folderStore(join(root, "store"));
const key = "ws/bench/episodes/bench/source/recording";
await mkdir(join(store.path(key), ".."), { recursive: true });
await symlink(resolve(file), store.path(key));
const bytes = (await stat(file)).size;

const q = new MemoryQueue();
const id = q.add("ingest", { assetId: "6f1d3a0e-8d1c-4c64-9a35-2f5a7a0d9c11", key, bytes });
const started = Date.now();
const outcome = await runOnce(q, registry([ingestHandler(store, { workRoot: root })]), { workerId: "bench", leaseSeconds: 600 });
const seconds = (Date.now() - started) / 1000;
const out = q.row(id).output as { durationS: number } | null;
console.log(JSON.stringify({ outcome: outcome.kind, gb: +(bytes / 1e9).toFixed(2), minutes: out ? +(out.durationS / 60).toFixed(1) : null, seconds: +seconds.toFixed(1), error: q.row(id).error }));
await rm(root, { recursive: true, force: true });
