import { createClient } from "@/lib/supabase/server";
import { getShell } from "./shell";
import { buildToday, type TodayData } from "./today.build";

export type { TodayData } from "./today.build";

/** Everything the Today screen needs, in one call. Row-level security limits it to the person's workspace. */
export async function getToday(now = new Date()): Promise<TodayData | null> {
  const shell = await getShell();
  if (!shell.workspace) return null;
  const ws = shell.workspace.id;
  const supabase = await createClient();

  const weekAhead = new Date(now.getTime() + 8 * 86_400_000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  const [shows, episodes, posts, failed] = await Promise.all([
    supabase.from("shows").select("id, name, kind, theme, compass, show_channels(count)").eq("workspace_id", ws).order("created_at"),
    supabase.from("episodes").select("id, title, state, show_id, created_at").eq("workspace_id", ws).neq("state", "published").order("created_at", { ascending: false }).limit(50),
    supabase.from("posts").select("platform, scheduled_for, episodes(show_id)").eq("workspace_id", ws).in("status", ["scheduled", "waiting_review"]).gte("scheduled_for", now.toISOString()).lt("scheduled_for", weekAhead),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "failed").gte("created_at", weekAgo),
  ]);
  const firstError = shows.error ?? episodes.error ?? posts.error ?? failed.error;
  if (firstError) throw new Error(`Today could not load: ${firstError.message}`);

  const episodeIds = (episodes.data ?? []).map((e) => e.id);
  const jobs = episodeIds.length
    ? await supabase.from("jobs").select("episode_id, step, status, created_at, lease_until").in("episode_id", episodeIds)
    : { data: [], error: null };
  if (jobs.error) throw new Error(`Today could not load jobs: ${jobs.error.message}`);

  const data = buildToday(
    {
      shows: (shows.data ?? []).map((s) => ({ id: s.id, name: s.name, kind: s.kind, theme: s.theme, compass: s.compass, channels: s.show_channels[0]?.count ?? 0 })),
      episodes: episodes.data ?? [],
      jobs: jobs.data ?? [],
      posts: (posts.data ?? []).map((p) => ({ platform: p.platform, scheduled_for: p.scheduled_for, show_id: p.episodes?.show_id ?? null })),
      failedJobsThisWeek: failed.count ?? 0,
    },
    now,
    shell.timeZone,
  );
  return data;
}
