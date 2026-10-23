import { createClient } from "@/lib/supabase/server";
import { getShell } from "./shell";
import { buildPlan, planWindow, postWindow, weeksAheadOf, type PlanData } from "./plan.build";

export type { PlanData, PlanIdea, PlanShowBoard, PlanSlot, PlanWeek } from "./plan.build";

/**
 * The plan board: the weeks ahead, every show's posting slots in them, what is
 * already heading for each one, and the ideas written against the rest. Empty
 * slots are the point, so nothing here is padded out.
 */
export async function getPlan(weeksParam?: string, now = new Date()): Promise<PlanData | null> {
  const shell = await getShell();
  if (!shell.workspace) return null;
  const ws = shell.workspace.id;
  const weeks = weeksAheadOf(weeksParam);
  const window = planWindow(now, weeks, shell.timeZone);
  const posts = postWindow(window);
  const supabase = await createClient();

  const [shows, scheduled, ideas, anchors] = await Promise.all([
    supabase.from("shows").select("id, slug, name, theme, slots, compass").eq("workspace_id", ws).order("created_at"),
    supabase
      .from("posts")
      .select("scheduled_for, platform, status, episodes(show_id)")
      .eq("workspace_id", ws)
      .neq("status", "draft")
      .gte("scheduled_for", posts.from)
      .lt("scheduled_for", posts.to),
    supabase
      .from("ideas")
      .select("id, show_id, pillar, body, slot_at, state")
      .eq("workspace_id", ws)
      .neq("state", "dropped")
      .order("created_at"),
    supabase.from("time_anchors").select("name, date, recurrence").or(`workspace_id.is.null,workspace_id.eq.${ws}`),
  ]);

  const error = shows.error ?? scheduled.error ?? ideas.error ?? anchors.error;
  if (error) throw new Error(`The plan could not load: ${error.message}`);

  return buildPlan(
    {
      shows: shows.data ?? [],
      posts: (scheduled.data ?? []).map((p) => ({
        scheduled_for: p.scheduled_for,
        platform: p.platform,
        status: p.status,
        show_id: p.episodes?.show_id ?? null,
      })),
      ideas: ideas.data ?? [],
      anchors: anchors.data ?? [],
    },
    window,
    now,
    shell.timeZone,
  );
}
