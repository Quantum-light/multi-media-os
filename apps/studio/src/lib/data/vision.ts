import { Compass } from "@mmos/contracts";
import { createClient } from "@/lib/supabase/server";
import { getShell } from "./shell";

export type VisionShow = { slug: string; name: string };

export type VisionData = {
  shows: VisionShow[];
  current: VisionShow;
  /** ready: a valid compass; missing: none written yet; invalid: stored but fails the contract. */
  state: { kind: "ready"; compass: Compass } | { kind: "missing" } | { kind: "invalid"; problems: number };
};

/** The vision, mission, pillars and goal for one show (the first with a vision when none is chosen). */
export async function getVision(showSlug?: string): Promise<VisionData | null> {
  const shell = await getShell();
  if (!shell.workspace) return null;
  const supabase = await createClient();

  const { data, error } = await supabase.from("shows").select("slug, name, compass").eq("workspace_id", shell.workspace.id).order("created_at");
  if (error) throw new Error(`Vision could not load: ${error.message}`);
  if (!data || data.length === 0) return null;

  const chosen = data.find((s) => s.slug === showSlug) ?? data.find((s) => s.compass !== null) ?? data[0]!;
  const shows = data.map(({ slug, name }) => ({ slug, name }));
  const current = { slug: chosen.slug, name: chosen.name };

  if (chosen.compass === null) return { shows, current, state: { kind: "missing" } };
  const parsed = Compass.safeParse(chosen.compass);
  if (!parsed.success) return { shows, current, state: { kind: "invalid", problems: parsed.error.issues.length } };
  return { shows, current, state: { kind: "ready", compass: parsed.data } };
}
