import type { StepName } from "@mmos/contracts";
import type { ClaimedJob, FailResult, Queue } from "../queue";

type Row = {
  id: string;
  step: StepName;
  input: unknown;
  status: "queued" | "running" | "succeeded" | "failed";
  attempts: number;
  leaseUntil: number | null;
  runAfter: number;
  output: unknown;
  error: string | null;
  costPence: number;
};

/**
 * Test double that follows the same rules as private.claim_job and friends
 * (migration 0006, proven by packages/db/tests/job_engine.sql). Time is a
 * number you move by hand, so tests never wait.
 */
export class MemoryQueue implements Queue {
  now = 0;
  readonly rows = new Map<string, Row>();
  heartbeats = 0;

  add(step: StepName, input: unknown, id = `job-${this.rows.size + 1}`): string {
    this.rows.set(id, { id, step, input, status: "queued", attempts: 0, leaseUntil: null, runAfter: this.now, output: null, error: null, costPence: 0 });
    return id;
  }

  row(id: string): Row {
    const r = this.rows.get(id);
    if (!r) throw new Error(`no job ${id}`);
    return r;
  }

  async claim(_worker: string, steps: readonly StepName[], leaseSeconds: number, maxAttempts: number): Promise<ClaimedJob | null> {
    for (const r of this.rows.values()) {
      if (r.status === "running" && r.leaseUntil !== null && r.leaseUntil < this.now && r.attempts >= maxAttempts) {
        Object.assign(r, { status: "failed", error: "Lease ran out on the final attempt", leaseUntil: null });
      }
    }
    const ready = [...this.rows.values()]
      .filter((r) => steps.includes(r.step))
      .filter((r) => (r.status === "queued" && r.runAfter <= this.now) || (r.status === "running" && r.leaseUntil !== null && r.leaseUntil < this.now))
      .sort((a, b) => a.runAfter - b.runAfter)[0];
    if (!ready) return null;
    Object.assign(ready, { status: "running", attempts: ready.attempts + 1, error: null, leaseUntil: this.now + leaseSeconds * 1000 });
    return { id: ready.id, workspaceId: "ws", episodeId: "ep", step: ready.step, input: ready.input, attempt: ready.attempts };
  }

  private held(job: ClaimedJob): Row | null {
    const r = this.rows.get(job.id);
    return r && r.status === "running" && r.attempts === job.attempt ? r : null;
  }

  async heartbeat(job: ClaimedJob, leaseSeconds: number): Promise<boolean> {
    this.heartbeats += 1;
    const r = this.held(job);
    if (!r) return false;
    r.leaseUntil = this.now + leaseSeconds * 1000;
    return true;
  }

  async complete(job: ClaimedJob, output: unknown, costPence: number): Promise<boolean> {
    const r = this.held(job);
    if (!r) return false;
    Object.assign(r, { status: "succeeded", output, leaseUntil: null, error: null, costPence: r.costPence + Math.max(0, costPence) });
    return true;
  }

  async fail(job: ClaimedJob, error: string, retryable: boolean, maxAttempts: number): Promise<FailResult> {
    const r = this.held(job);
    if (!r) return null;
    const next = retryable && r.attempts < maxAttempts ? "queued" : "failed";
    Object.assign(r, {
      status: next,
      error,
      leaseUntil: null,
      runAfter: next === "queued" ? this.now + Math.min(30 * 2 ** (r.attempts - 1), 1800) * 1000 : r.runAfter,
    });
    return next;
  }
}
