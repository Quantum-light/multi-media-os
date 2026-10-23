import { createClient } from "@/lib/supabase/server";
import { buildSlate, type ClipRow, type ClipSlate } from "./clips.build";
import { getShell } from "./shell";

export type { ClipCard, ClipSlate, ClipState } from "./clips.build";

export type ClipStudioData = {
  episodeId: string;
  title: string;
  show: string;
  slate: ClipSlate;
  /** Whether this person may change a clip's state at all. */
  canDecide: boolean;
};

/** Everything Clip Studio needs for one episode, in one call. */
export async function getClipStudio(episodeId: string): Promise<ClipStudioData | null> {
  const shell = await getShell();
  if (!shell.workspace) return null;
  const supabase = await createClient();
  const ws = shell.workspace.id;
  const { data: auth } = await supabase.auth.getUser();

  const [episode, clips, role] = await Promise.all([
    supabase.from("episodes").select("id, title, shows(name)").eq("workspace_id", ws).eq("id", episodeId).maybeSingle(),
    supabase
      .from("clips")
      .select("id, job_id, rank, state, signal, score, start_s, end_s, hook, quote, reason, decided_at, created_at")
      .eq("workspace_id", ws)
      .eq("episode_id", episodeId)
      .order("created_at", { ascending: false })
      .order("rank", { ascending: true }),
    supabase.from("members").select("role").eq("workspace_id", ws).eq("user_id", auth.user?.id ?? "").maybeSingle(),
  ]);

  const firstError = episode.error ?? clips.error ?? role.error;
  if (firstError) throw new Error(`Clip Studio could not load: ${firstError.message}`);
  if (!episode.data) return null;

  const rows: ClipRow[] = (clips.data ?? []).map((c) => ({
    id: c.id,
    job_id: c.job_id,
    rank: c.rank,
    state: c.state,
    signal: c.signal,
    score: Number(c.score),
    start_s: Number(c.start_s),
    end_s: Number(c.end_s),
    hook: c.hook,
    quote: c.quote,
    reason: c.reason,
    decided_at: c.decided_at,
    created_at: c.created_at,
  }));

  const slate = buildSlate(rows, await targetOf(supabase, ws, rows));

  return {
    episodeId: episode.data.id,
    title: episode.data.title ?? "Untitled recording",
    show: episode.data.shows?.name ?? "A show",
    slate,
    canDecide: role.data?.role === "owner" || role.data?.role === "editor" || role.data?.role === "approver",
  };
}

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * How many shorts the episode wanted. The finder records it on the job it wrote
 * the slate against (the `target` of its ClipPlan), so the number shown is the
 * one that run was actually asked for, not today's setting.
 */
async function targetOf(supabase: Client, ws: string, rows: ClipRow[]): Promise<number | null> {
  if (rows.length === 0) return null;
  const newest = rows.reduce((a, b) => (b.created_at > a.created_at ? b : a));
  const { data } = await supabase.from("jobs").select("output").eq("workspace_id", ws).eq("id", newest.job_id).maybeSingle();
  const output = data?.output;
  if (output === null || typeof output !== "object" || Array.isArray(output)) return null;
  const target = (output as Record<string, unknown>)["target"];
  return typeof target === "number" && Number.isInteger(target) && target > 0 ? target : null;
}
