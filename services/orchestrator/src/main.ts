/**
 * The worker process (Railway). Claims jobs for the steps it has handlers for, runs them,
 * and records results. Stops cleanly on SIGTERM so a deploy never strands a job: the lease
 * simply runs out and another worker picks it up.
 */
import { hostname } from "node:os";
import { PgQueue } from "./pg-queue";
import { runWorker } from "./runner";
import { r2WorkerStore } from "./storage";
import { ingestHandler } from "./steps/ingest";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is missing. Set it in Railway (the Supabase direct connection string).");
  process.exit(1);
}

const workerId = process.env.WORKER_ID ?? `${hostname()}-${process.pid}`;
const queue = PgQueue.connect(databaseUrl);
const store = r2WorkerStore();
const stop = new AbortController();

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    console.log(`[worker] ${sig}: finishing the current job, then stopping`);
    stop.abort();
  });
}

console.log(`[worker] ${workerId} ready: ingest`);
await runWorker(queue, [ingestHandler(store)], {
  workerId,
  signal: stop.signal,
  leaseSeconds: Number(process.env.LEASE_SECONDS ?? 300),
  onOutcome: (o) => {
    if (o.kind !== "idle") console.log(`[worker] ${o.step} ${o.jobId} ${o.kind}${"error" in o ? `: ${o.error}` : ""}`);
  },
  onError: (e) => console.error("[worker] queue error", e),
});
await queue.close();
console.log("[worker] stopped");
