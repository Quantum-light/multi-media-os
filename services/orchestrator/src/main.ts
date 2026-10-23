/**
 * The worker process (Railway). Claims jobs for the steps it has handlers for, runs them,
 * and records results. Stops cleanly on SIGTERM so a deploy never strands a job: the lease
 * simply runs out and another worker picks it up.
 */
import { hostname } from "node:os";
import { databaseConnection } from "./db/connect";
import { PgQueue } from "./pg-queue";
import { runWorker } from "./runner";
import { r2WorkerStore } from "./storage";
import { assemblyAiTranscriber } from "./transcribe/assemblyai";
import { ingestHandler } from "./steps/ingest";
import { transcribeHandler } from "./steps/transcribe";

const connection = databaseConnection(process.env);
if ("error" in connection) {
  console.error(`[worker] ${connection.error}`);
  process.exit(1);
}
for (const warning of connection.warnings) console.warn(`[worker] ${warning}`);
console.log(`[worker] database: ${connection.describe}`);

const workerId = process.env.WORKER_ID ?? `${hostname()}-${process.pid}`;
const queue = PgQueue.connect(connection.url);
const store = r2WorkerStore();
const stop = new AbortController();

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    console.log(`[worker] ${sig}: finishing the current job, then stopping`);
    stop.abort();
  });
}

/**
 * A step is only offered when it can actually be done. Without its key, the
 * handler is left out and its jobs stay queued — which is honest, and lets the
 * episode carry on the moment the key is added. Registering it anyway would
 * fail every job on arrival and mark the episode failed.
 */
const handlers = [ingestHandler(store)];
if ((process.env["ASSEMBLYAI_API_KEY"] ?? "").trim() !== "") {
  handlers.push(transcribeHandler(store, assemblyAiTranscriber()));
} else {
  console.warn("[worker] transcribe is not available: ASSEMBLYAI_API_KEY is not set. Its jobs will wait in the queue.");
}

console.log(`[worker] ${workerId} ready: ${handlers.map((h) => h.step.name).join(", ")}`);
await runWorker(queue, handlers, {
  workerId,
  signal: stop.signal,
  leaseSeconds: Number(process.env.LEASE_SECONDS ?? 300),
  onOutcome: (o) => {
    if (o.kind !== "idle") console.log(`[worker] ${o.step} ${o.jobId} ${o.kind}${"error" in o ? `: ${o.error}` : ""}`);
  },
  onError: (e) => console.error(`[worker] queue error: ${e instanceof Error ? e.message : String(e)} (backing off)`),
});
await queue.close();
console.log("[worker] stopped");
