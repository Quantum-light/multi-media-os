"use server";

import { revalidatePath } from "next/cache";
import { getShell } from "@/lib/data";
import type { SaveResult } from "@/lib/save";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = new Set(["episode", "piece"]);

/**
 * Holds one piece for a moment in time. `piece` arrives as "kind:id", the way the
 * screen lists it, and row-level security decides whether this person may hold
 * anything in this workspace.
 */
export async function holdForAnchor(piece: string, anchorId: string): Promise<SaveResult> {
  const [kind, id] = piece.split(":");
  const problems: string[] = [];
  if (!kind || !KINDS.has(kind) || !id || !UUID.test(id)) problems.push("Choose something to hold.");
  if (!UUID.test(anchorId)) problems.push("Choose the moment to hold it for.");
  if (problems.length > 0) return { ok: false, message: "Nearly there. These parts still need you:", problems };

  const shell = await getShell();
  if (!shell.workspace) return { ok: false, message: "You are not in a workspace yet.", problems: [] };

  const supabase = await createClient();
  const already = await supabase
    .from("holds")
    .select("id")
    .eq("workspace_id", shell.workspace.id)
    .eq("anchor_id", anchorId)
    .eq("piece_kind", kind!)
    .eq("piece_id", id!)
    .limit(1);
  if (already.error) return { ok: false, message: `It could not be saved: ${already.error.message}`, problems: [] };
  if ((already.data ?? []).length > 0) return { ok: false, message: "That is already being held for this moment.", problems: [] };

  const { data, error } = await supabase
    .from("holds")
    .insert({ workspace_id: shell.workspace.id, anchor_id: anchorId, piece_kind: kind!, piece_id: id! })
    .select("id");

  if (error) return { ok: false, message: `It could not be saved: ${error.message}`, problems: [] };
  if (!data || data.length === 0) return { ok: false, message: "You do not have permission to hold anything here.", problems: [] };

  revalidatePath("/constellation");
  return { ok: true };
}
