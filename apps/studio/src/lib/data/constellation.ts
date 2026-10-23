import { createClient } from "@/lib/supabase/server";
import { getShell } from "./shell";
import { buildConstellation, type ConstellationData } from "./constellation.build";

export type { ConstellationData, ThemeNode, ThemeLink, Moment, HeldPiece, HoldablePiece } from "./constellation.build";

/** Content through time: the themes, what connects to what, and what is being held for which moment. */
export async function getConstellation(now = new Date()): Promise<ConstellationData | null> {
  const shell = await getShell();
  if (!shell.workspace) return null;
  const ws = shell.workspace.id;
  const supabase = await createClient();

  const [themes, edges, anchors, holds, episodes, pieces] = await Promise.all([
    supabase.from("themes").select("id, name, slug").eq("workspace_id", ws).order("name"),
    supabase.from("edges").select("from_kind, from_id, to_kind, to_id, kind, weight").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(500),
    supabase.from("time_anchors").select("id, name, date, recurrence, scope").or(`workspace_id.is.null,workspace_id.eq.${ws}`).order("date"),
    supabase.from("holds").select("id, anchor_id, piece_id, piece_kind, created_at").eq("workspace_id", ws).order("created_at", { ascending: false }),
    supabase.from("episodes").select("id, title").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(60),
    supabase.from("pieces").select("id, kind, platform, episode_id").eq("workspace_id", ws).order("updated_at", { ascending: false }).limit(60),
  ]);
  const error = themes.error ?? edges.error ?? anchors.error ?? holds.error ?? episodes.error ?? pieces.error;
  if (error) throw new Error(`Constellation could not load: ${error.message}`);

  return buildConstellation(
    {
      themes: themes.data ?? [],
      edges: edges.data ?? [],
      anchors: anchors.data ?? [],
      holds: holds.data ?? [],
      episodes: episodes.data ?? [],
      pieces: pieces.data ?? [],
    },
    now,
    shell.timeZone,
  );
}
