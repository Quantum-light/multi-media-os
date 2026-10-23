import { createClient } from "@/lib/supabase/server";
import { getShell } from "./shell";
import { buildAnalytics, type AnalyticsData } from "./analytics.build";

export type { AnalyticsData } from "./analytics.build";

/**
 * Platforms whose analytics are connected and reporting numbers.
 *
 * Nothing reads a platform yet: there is no analytics connection in the schema,
 * and `channels.status` only says whether a channel can post. So this is empty,
 * and every KPI shows as typed in by hand. When the first analytics source is
 * wired up, it is read here and the screen fills itself in.
 */
const MEASURING_PLATFORMS: string[] = [];

/** Who each show is for against who is watching, and the real number behind every KPI. */
export async function getAnalytics(): Promise<AnalyticsData | null> {
  const shell = await getShell();
  if (!shell.workspace) return null;
  const ws = shell.workspace.id;
  const supabase = await createClient();

  const [shows, brands, channels, posts] = await Promise.all([
    supabase.from("shows").select("id, brand_id, slug, name, compass").eq("workspace_id", ws).order("created_at"),
    supabase.from("brands").select("id, name, brand_kit").eq("workspace_id", ws).order("created_at"),
    supabase.from("channels").select("platform, handle, status").eq("workspace_id", ws).order("platform"),
    supabase.from("posts").select("platform, status, live_url, scheduled_for, episodes(show_id)").eq("workspace_id", ws).order("scheduled_for", { ascending: false }).limit(200),
  ]);

  const error = shows.error ?? brands.error ?? channels.error ?? posts.error;
  if (error) throw new Error(`Analytics could not load: ${error.message}`);

  return buildAnalytics({
    shows: shows.data ?? [],
    brands: brands.data ?? [],
    channels: channels.data ?? [],
    posts: (posts.data ?? []).map((p) => ({
      platform: p.platform,
      status: p.status,
      live_url: p.live_url,
      scheduled_for: p.scheduled_for,
      show_id: p.episodes?.show_id ?? null,
    })),
    measuringPlatforms: MEASURING_PLATFORMS,
  });
}
