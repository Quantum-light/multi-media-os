import type postgres from "postgres";
import type { ClipPlan, ClipState, ScoredClip } from "@mmos/contracts";

type Sql = ReturnType<typeof postgres>;

/** Where a slate belongs: the workspace, the episode, and the job that found it. */
export type SlateRef = { workspaceId: string; episodeId: string; jobId: string };

/** One row of public.clips, in the table's own column names. */
export type ClipRow = {
  workspace_id: string;
  episode_id: string;
  job_id: string;
  rank: number;
  state: ClipState;
  signal: string;
  score: number;
  start_s: number;
  end_s: number;
  hook: string;
  quote: string;
  reason: string;
};

const COLUMNS = ["workspace_id", "episode_id", "job_id", "rank", "state", "signal", "score", "start_s", "end_s", "hook", "quote", "reason"] as const;

/** The whole slate as rows: chosen first, then reserve, ranked 1 upwards across both. */
export function slateRows(ref: SlateRef, plan: ClipPlan): ClipRow[] {
  const row = (c: ScoredClip, index: number, state: ClipState): ClipRow => ({
    workspace_id: ref.workspaceId,
    episode_id: ref.episodeId,
    job_id: ref.jobId,
    rank: index + 1,
    state,
    signal: c.signal,
    score: c.score,
    start_s: c.startS,
    end_s: c.endS,
    hook: c.hook,
    quote: c.quote,
    reason: c.reason,
  });
  const chosen = plan.chosen.map((c, i) => row(c, i, "chosen"));
  const reserve = plan.reserve.map((c, i) => row(c, chosen.length + i, "reserve"));
  return [...chosen, ...reserve];
}

/**
 * Writes a slate to public.clips. Append-only by design (migration 0017): a re-run writes
 * a fresh set of rows against its own job_id, and nothing here ever deletes.
 */
export interface ClipSlateWriter {
  save(ref: SlateRef, plan: ClipPlan): Promise<number>;
}

/** The worker's own connection, so the insert needs no definer function. */
export class PgClipSlateWriter implements ClipSlateWriter {
  constructor(private readonly sql: Sql) {}

  async save(ref: SlateRef, plan: ClipPlan): Promise<number> {
    const rows = slateRows(ref, plan);
    // An episode that gave nothing writes nothing: an empty slate is a real answer.
    if (rows.length === 0) return 0;
    await this.sql`insert into public.clips ${this.sql(rows, ...COLUMNS)}`;
    return rows.length;
  }
}
