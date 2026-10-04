import type { StepName } from "@mmos/contracts";
import { NonRetryableError, type Handler } from "./handler";
import type { ClaimedJob, Queue } from "./queue";

export type RunnerOptions = {
  workerId: string;
  leaseSeconds?: number;
  maxAttempts?: number;
};

export type Outcome =
  | { kind: "idle" }
  | { kind: "succeeded"; jobId: string; step: StepName }
  | { kind: "retrying" | "failed"; jobId: string; step: StepName; error: string }
  | { kind: "lost"; jobId: string; step: StepName };

const DEFAULT_LEASE = 300;
const DEFAULT_MAX_ATTEMPTS = 3;

/** Builds the step → handler map once, refusing two handlers for one step. */
export function registry(handlers: readonly Handler[]): ReadonlyMap<StepName, Handler> {
  const map = new Map<StepName, Handler>();
  for (const h of handlers) {
    if (map.has(h.step.name)) throw new Error(`Two handlers for step "${h.step.name}"`);
    map.set(h.step.name, h);
  }
  return map;
}

/** Claims at most one job, runs it under a heartbeat, and records exactly one result. */
export async function runOnce(queue: Queue, handlers: ReadonlyMap<StepName, Handler>, options: RunnerOptions): Promise<Outcome> {
  const lease = options.leaseSeconds ?? DEFAULT_LEASE;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  if (handlers.size === 0) return { kind: "idle" };

  const job = await queue.claim(options.workerId, [...handlers.keys()], lease, maxAttempts);
  if (!job) return { kind: "idle" };

  const fail = async (error: string, retryable: boolean): Promise<Outcome> => {
    const status = await queue.fail(job, error, retryable, maxAttempts);
    if (status === null) return { kind: "lost", jobId: job.id, step: job.step };
    return { kind: status === "queued" ? "retrying" : "failed", jobId: job.id, step: job.step, error };
  };

  const handler = handlers.get(job.step);
  if (!handler) return fail(`No handler for step "${job.step}" on this worker`, false);

  const input = handler.step.input.safeParse(job.input);
  if (!input.success) return fail(`Input does not match the ${job.step} contract: ${summarise(input.error.issues)}`, false);

  const lost = new AbortController();
  const beat = startHeartbeat(queue, job, lease, () => lost.abort());
  try {
    const result = await handler.run(input.data, { job, signal: lost.signal });
    if (lost.signal.aborted) return { kind: "lost", jobId: job.id, step: job.step };
    const output = handler.step.output.safeParse(result.output);
    if (!output.success) return fail(`Output does not match the ${job.step} contract: ${summarise(output.error.issues)}`, false);
    const saved = await queue.complete(job, output.data, result.costPence ?? 0);
    return saved ? { kind: "succeeded", jobId: job.id, step: job.step } : { kind: "lost", jobId: job.id, step: job.step };
  } catch (error) {
    if (lost.signal.aborted) return { kind: "lost", jobId: job.id, step: job.step };
    const message = error instanceof Error ? error.message : String(error);
    return fail(message || "Step failed without a message", !(error instanceof NonRetryableError));
  } finally {
    clearInterval(beat);
  }
}

/** Extends the lease every third of its length; tells the caller once it is lost. */
function startHeartbeat(queue: Queue, job: ClaimedJob, leaseSeconds: number, onLost: () => void): ReturnType<typeof setInterval> {
  let stopped = false;
  const timer = setInterval(() => {
    if (stopped) return;
    queue.heartbeat(job, leaseSeconds).then(
      (ok) => {
        if (!ok && !stopped) {
          stopped = true;
          onLost();
        }
      },
      () => {
        // A missed beat is fine: the lease has two more chances before it runs out.
      },
    );
  }, Math.max(10, (leaseSeconds * 1000) / 3));
  return timer;
}

function summarise(issues: readonly { path: (string | number)[]; message: string }[]): string {
  return issues.slice(0, 3).map((i) => `${i.path.join(".") || "(root)"} ${i.message}`).join("; ");
}

export type WorkerOptions = RunnerOptions & {
  signal: AbortSignal;
  idleMs?: number;
  onOutcome?: (outcome: Outcome) => void;
  onError?: (error: unknown) => void;
};

/** Runs jobs until the signal aborts. Sleeps when the queue is empty or the database is unreachable. */
export async function runWorker(queue: Queue, handlers: readonly Handler[], options: WorkerOptions): Promise<void> {
  const map = registry(handlers);
  const idleMs = options.idleMs ?? 2000;
  let errorStreak = 0;
  while (!options.signal.aborted) {
    try {
      const outcome = await runOnce(queue, map, options);
      errorStreak = 0;
      options.onOutcome?.(outcome);
      if (outcome.kind === "idle") await sleep(idleMs, options.signal);
    } catch (error) {
      errorStreak += 1;
      options.onError?.(error);
      await sleep(Math.min(idleMs * 2 ** errorStreak, 60_000), options.signal);
    }
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
  });
}
