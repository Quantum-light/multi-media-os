import { createClient } from "@/lib/supabase/server";
import { getShell } from "./shell";
import { buildShows, type ShowsData } from "./shows.build";

export type { ShowsData } from "./shows.build";

/** Brands, their shows, and where each show posts. */
export async function getShows(): Promise<ShowsData | null> {
  const shell = await getShell();
  if (!shell.workspace) return null;
  const ws = shell.workspace.id;
  const supabase = await createClient();

  const [brands, shows, channels, links] = await Promise.all([
    supabase.from("brands").select("id, slug, name, brand_kit").eq("workspace_id", ws).order("created_at"),
    supabase.from("shows").select("id, brand_id, slug, name, kind, theme, slots, approval_mode, compass").eq("workspace_id", ws).order("created_at"),
    supabase.from("channels").select("id, platform, handle, status").eq("workspace_id", ws).order("platform"),
    supabase.from("show_channels").select("show_id, channel_id, carries").eq("workspace_id", ws),
  ]);
  const error = brands.error ?? shows.error ?? channels.error ?? links.error;
  if (error) throw new Error(`Shows could not load: ${error.message}`);

  return buildShows({ brands: brands.data ?? [], shows: shows.data ?? [], channels: channels.data ?? [], links: links.data ?? [] });
}
