import type { StepName } from "@mmos/contracts";

/** A job a worker holds. `attempt` is the fencing token: only the holder of this attempt may finish it. */
export type ClaimedJob = {
  id: string;
  workspaceId: string;
  episodeId: string;
  step: StepName;
  input: unknown;
  attempt: number;
};

export type FailResult = "queued" | "failed" | null;

/**
 * The queue as the runner sees it. Postgres is the real one (`PgQueue`);
 * `MemoryQueue` mirrors its rules for tests. Every method that ends or
 * extends work returns false/null when the lease was lost.
 */
export interface Queue {
  claim(workerId: string, steps: readonly StepName[], leaseSeconds: number, maxAttempts: number): Promise<ClaimedJob | null>;
  heartbeat(job: ClaimedJob, leaseSeconds: number): Promise<boolean>;
  complete(job: ClaimedJob, output: unknown, costPence: number): Promise<boolean>;
  fail(job: ClaimedJob, error: string, retryable: boolean, maxAttempts: number): Promise<FailResult>;
}
