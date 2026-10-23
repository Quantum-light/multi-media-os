"use server";

import { revalidatePath } from "next/cache";
import { getShell } from "@/lib/data";
import type { SaveResult } from "@/lib/save";
import { createClient } from "@/lib/supabase/server";

/**
 * The only writes Clip Studio makes. A person may change a clip's state and
 * nothing else: the finder's hook, quote, score and reason are a record of what
 * it offered, and the table refuses inserts and deletes outright.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** This clip is good to cut. */
export async function approveClip(episodeId: string, clipId: string): Promise<SaveResult> {
  return setState(episodeId, clipId, "approved", null);
}

/** Not this one. It stays on the record, set aside. */
export async function rejectClip(episodeId: string, clipId: string): Promise<SaveResult> {
  return setState(episodeId, clipId, "rejected", null);
}

/** Pull one up from the reserve, which makes it chosen. */
export async function promoteClip(episodeId: string, clipId: string): Promise<SaveResult> {
  return setState(episodeId, clipId, "chosen", "reserve");
}

/**
 * One state change, scoped to the workspace. `from` names the state the clip has
 * to be in for the change to make sense; row-level security decides whether this
 * person may change anything here at all.
 */
async function setState(episodeId: string, clipId: string, to: string, from: string | null): Promise<SaveResult> {
  const problems: string[] = [];
  if (!UUID.test(episodeId)) problems.push("That episode could not be recognised.");
  if (!UUID.test(clipId)) problems.push("That clip could not be recognised.");
  if (problems.length > 0) return { ok: false, message: "This could not be saved:", problems };

  const shell = await getShell();
  if (!shell.workspace) return { ok: false, message: "You are not in a workspace yet.", problems: [] };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  let update = supabase
    .from("clips")
    .update({ state: to, decided_at: new Date().toISOString(), decided_by: auth.user?.id ?? null })
    .eq("workspace_id", shell.workspace.id)
    .eq("episode_id", episodeId)
    .eq("id", clipId);
  if (from !== null) update = update.eq("state", from);

  const { data, error } = await update.select("id");
  if (error) return { ok: false, message: `It could not be saved: ${error.message}`, problems: [] };
  if (!data || data.length === 0) {
    return from !== null
      ? { ok: false, message: "That clip is no longer in the reserve. Reload the board to see where it stands.", problems: [] }
      : { ok: false, message: "That clip could not be changed. You may not have permission to decide here.", problems: [] };
  }

  revalidatePath(`/review/${episodeId}/clips`);
  revalidatePath(`/review/${episodeId}`);
  return { ok: true };
}
