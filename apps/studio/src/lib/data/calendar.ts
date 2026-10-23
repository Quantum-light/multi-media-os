import { createClient } from "@/lib/supabase/server";
import { getShell } from "./shell";
import { buildCalendar, monthOf, monthWindow, selectionFrom, type CalendarData } from "./calendar.build";

export type { CalendarData, CalendarLayers, LayerOption, CalendarSelection } from "./calendar.build";

/** What the calendar screen reads from its own address: the month, and the layers showing. */
export type CalendarParams = { month?: string | undefined; show?: string | string[] | undefined; platform?: string | string[] | undefined };

/** One month: every scheduled or live post, the themes behind them, and the moments in time worth planning around. */
export async function getCalendar(params: CalendarParams = {}, now = new Date()): Promise<CalendarData | null> {
  const shell = await getShell();
  if (!shell.workspace) return null;
  const ws = shell.workspace.id;
  const month = monthOf(params.month, now, shell.timeZone);
  const window = monthWindow(month);
  const supabase = await createClient();

  const [shows, posts, anchors, themes, edges] = await Promise.all([
    supabase.from("shows").select("id, name, slug, theme").eq("workspace_id", ws).order("created_at"),
    supabase.from("posts").select("scheduled_for, platform, status, episode_id, episodes(show_id)").eq("workspace_id", ws).neq("status", "draft").gte("scheduled_for", window.from).lt("scheduled_for", window.to),
    supabase.from("time_anchors").select("name, date, recurrence").or(`workspace_id.is.null,workspace_id.eq.${ws}`),
    supabase.from("themes").select("id, name").eq("workspace_id", ws).order("name"),
    supabase.from("edges").select("from_kind, from_id, to_kind, to_id").eq("workspace_id", ws).or("from_kind.eq.theme,to_kind.eq.theme"),
  ]);
  const error = shows.error ?? posts.error ?? anchors.error ?? themes.error ?? edges.error;
  if (error) throw new Error(`Calendar could not load: ${error.message}`);

  return buildCalendar(
    {
      shows: shows.data ?? [],
      posts: (posts.data ?? []).map((p) => ({ scheduled_for: p.scheduled_for, platform: p.platform, status: p.status, episode_id: p.episode_id, show_id: p.episodes?.show_id ?? null })),
      anchors: anchors.data ?? [],
      themes: themes.data ?? [],
      edges: edges.data ?? [],
    },
    month,
    now,
    shell.timeZone,
    selectionFrom(params),
  );
}
