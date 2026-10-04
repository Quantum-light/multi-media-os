import postgres from "postgres";
import { StepName } from "@mmos/contracts";
import type { ClaimedJob, FailResult, Queue } from "./queue";

type Sql = ReturnType<typeof postgres>;
type JobRow = { id: string; workspace_id: string; episode_id: string; step: string; input: unknown; attempts: number };

/** The real queue: thin calls to the private.* functions in migration 0006. */
export class PgQueue implements Queue {
  constructor(private readonly sql: Sql) {}

  /** Connects with a direct database URL (never the browser key). */
  static connect(databaseUrl: string): PgQueue {
    return new PgQueue(postgres(databaseUrl, { max: 4, prepare: false, idle_timeout: 30 }));
  }

  async claim(workerId: string, steps: readonly StepName[], leaseSeconds: number, maxAttempts: number): Promise<ClaimedJob | null> {
    const rows = await this.sql<JobRow[]>`
      select id, workspace_id, episode_id, step, input, attempts
      from private.claim_job(${workerId}, ${this.sql.array([...steps])}::text[], ${leaseSeconds}, ${maxAttempts})`;
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      episodeId: row.episode_id,
      step: StepName.parse(row.step),
      input: row.input,
      attempt: row.attempts,
    };
  }

  async heartbeat(job: ClaimedJob, leaseSeconds: number): Promise<boolean> {
    const [row] = await this.sql<{ ok: boolean }[]>`select private.heartbeat_job(${job.id}, ${job.attempt}, ${leaseSeconds}) as ok`;
    return row?.ok === true;
  }

  async complete(job: ClaimedJob, output: unknown, costPence: number): Promise<boolean> {
    const [row] = await this.sql<{ ok: boolean }[]>`
      select private.complete_job(${job.id}, ${job.attempt}, ${this.sql.json(output as postgres.JSONValue)}, ${Math.round(costPence)}) as ok`;
    return row?.ok === true;
  }

  async fail(job: ClaimedJob, error: string, retryable: boolean, maxAttempts: number): Promise<FailResult> {
    const [row] = await this.sql<{ status: string | null }[]>`
      select private.fail_job(${job.id}, ${job.attempt}, ${error}, ${retryable}, ${maxAttempts}) as status`;
    const status = row?.status ?? null;
    return status === "queued" || status === "failed" ? status : null;
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}
