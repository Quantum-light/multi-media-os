import { createClient } from "@/lib/supabase/server";
import { getShell } from "./shell";
import { buildCalendar, monthOf, monthWindow, type CalendarData } from "./calendar.build";

export type { CalendarData } from "./calendar.build";

/** One month: every scheduled or live post, plus the moments in time worth planning around. */
export async function getCalendar(monthParam?: string, now = new Date()): Promise<CalendarData | null> {
  const shell = await getShell();
  if (!shell.workspace) return null;
  const ws = shell.workspace.id;
  const month = monthOf(monthParam, now, shell.timeZone);
  const window = monthWindow(month);
  const supabase = await createClient();

  const [shows, posts, anchors] = await Promise.all([
    supabase.from("shows").select("id, name, theme").eq("workspace_id", ws).order("created_at"),
    supabase.from("posts").select("scheduled_for, platform, status, episodes(show_id)").eq("workspace_id", ws).neq("status", "draft").gte("scheduled_for", window.from).lt("scheduled_for", window.to),
    supabase.from("time_anchors").select("name, date, recurrence").or(`workspace_id.is.null,workspace_id.eq.${ws}`),
  ]);
  const error = shows.error ?? posts.error ?? anchors.error;
  if (error) throw new Error(`Calendar could not load: ${error.message}`);

  return buildCalendar(
    {
      shows: shows.data ?? [],
      posts: (posts.data ?? []).map((p) => ({ scheduled_for: p.scheduled_for, platform: p.platform, status: p.status, show_id: p.episodes?.show_id ?? null })),
      anchors: anchors.data ?? [],
    },
    month,
    now,
    shell.timeZone,
  );
}
