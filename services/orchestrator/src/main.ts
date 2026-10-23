/**
 * The worker process (Railway). Claims jobs for the steps it has handlers for, runs them,
 * and records results. Stops cleanly on SIGTERM so a deploy never strands a job: the lease
 * simply runs out and another worker picks it up.
 *
 * A step whose key is missing is simply not offered: its jobs wait in the queue, and the
 * log says which setting to add. Publishing is not registered until M6.
 */
import { hostname } from "node:os";
import postgres from "postgres";
import { anthropic } from "@mmos/agents";
import { databaseConnection } from "./db/connect";
import { PgEpisodeReader } from "./episode";
import type { Handler } from "./handler";
import { PgQueue } from "./pg-queue";
import { assemblyAi } from "./providers/assemblyai";
import { compareChannels, type ChannelRow } from "./publish/check";
import { zernio } from "./publish/zernio";
import { runWorker } from "./runner";
import { understandHandler, writeHandler } from "./steps/agents";
import { cutHandler } from "./steps/cut";
import { ingestHandler } from "./steps/ingest";
import { clipHandler, storyboardHandler } from "./steps/shorts";
import { transcribeHandler } from "./steps/transcribe";
import { r2WorkerStore } from "./storage";

const env = process.env;
const connection = databaseConnection(env);
if ("error" in connection) {
  console.error(`[worker] ${connection.error}`);
  process.exit(1);
}
for (const warning of connection.warnings) console.warn(`[worker] ${warning}`);
console.log(`[worker] database: ${connection.describe}`);

const workerId = env.WORKER_ID ?? `${hostname()}-${process.pid}`;
const sql = postgres(connection.url, { max: 4, prepare: false, idle_timeout: 30, connection: { application_name: `mmos-worker ${workerId}` } });
const queue = new PgQueue(sql);
const reader = new PgEpisodeReader(sql);
const store = r2WorkerStore();
const stop = new AbortController();

const handlers: Handler[] = [ingestHandler(store), cutHandler({ store }), clipHandler({ reader }), storyboardHandler({ reader })];
const waiting: string[] = [];
if (env.ASSEMBLYAI_API_KEY) {
  const transcriber = assemblyAi({ apiKey: env.ASSEMBLYAI_API_KEY, ...(env.ASSEMBLYAI_BASE_URL ? { baseUrl: env.ASSEMBLYAI_BASE_URL } : {}) });
  handlers.push(transcribeHandler({ store, reader, transcriber }));
} else waiting.push("transcribe (add ASSEMBLYAI_API_KEY)");
if (env.ANTHROPIC_API_KEY) {
  const llm = anthropic({ apiKey: env.ANTHROPIC_API_KEY, ...(env.ANTHROPIC_MODEL ? { model: env.ANTHROPIC_MODEL } : {}) });
  handlers.push(understandHandler({ store, reader, llm }), writeHandler({ reader, llm }));
} else waiting.push("understand and write (add ANTHROPIC_API_KEY)");

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    console.log(`[worker] ${sig}: finishing the current job, then stopping`);
    stop.abort();
  });
}

console.log(`[worker] ${workerId} ready: ${handlers.map((h) => h.step.name).join(", ")}`);
if (waiting.length) console.log(`[worker] waiting for keys: ${waiting.join("; ")}`);
void checkZernio();

await runWorker(queue, handlers, {
  workerId,
  signal: stop.signal,
  leaseSeconds: Number(env.LEASE_SECONDS ?? 300),
  onOutcome: (o) => {
    if (o.kind !== "idle") console.log(`[worker] ${o.step} ${o.jobId} ${o.kind}${"error" in o ? `: ${o.error}` : ""}`);
  },
  onError: (e) => console.error(`[worker] queue error: ${e instanceof Error ? e.message : String(e)} (backing off)`),
});
await queue.close();
console.log("[worker] stopped");

/** Read-only, once at start: which channels Zernio can post to. Never posts anything. */
async function checkZernio() {
  if (!env.ZERNIO_API_KEY) return console.log("[zernio] ZERNIO_API_KEY not set; publishing is not available");
  try {
    const accounts = await zernio({ apiKey: env.ZERNIO_API_KEY }).listAccounts();
    const channels = await sql<ChannelRow[]>`select platform, handle, zernio_account_id from public.channels order by platform`;
    console.log(`[zernio] ${accounts.length} connected account(s): ${accounts.map((a) => `${a.platform}${a.username ? ` @${a.username.replace(/^@/, "")}` : ""} (${a.id})`).join(", ") || "none"}`);
    for (const line of compareChannels(channels, accounts)) console.log(`[zernio] ${line}`);
  } catch (e) {
    console.error(`[zernio] could not list accounts: ${e instanceof Error ? e.message : String(e)}`);
  }
}
