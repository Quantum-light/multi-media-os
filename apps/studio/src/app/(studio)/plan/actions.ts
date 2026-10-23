"use server";

import { revalidatePath } from "next/cache";
import { getShell } from "@/lib/data";
import { pillarsOf } from "@/lib/data/plan.build";
import type { SaveResult } from "@/lib/save";
import { createClient } from "@/lib/supabase/server";

const MAX_BODY = 280;

export type IdeaDraft = {
  showSlug: string;
  /** Must be one of that show's own pillars: an idea has to serve something. */
  pillar: string;
  body: string;
  /** The instant of the slot it answers, or null for an idea with no slot yet. */
  slotAt: string | null;
};

/**
 * Writes one idea against a slot. Her words, her pillar, her show: the board
 * never invents a line and attributes it to her, so there is nothing to parse
 * here beyond checking she filled it in.
 */
export async function saveIdea(draft: IdeaDraft): Promise<SaveResult> {
  const body = draft.body.trim();
  const pillar = draft.pillar.trim();
  const problems: string[] = [];
  if (body === "") problems.push("The idea is still empty. A line of your own words is enough.");
  if (body.length > MAX_BODY) problems.push(`The idea is longer than ${MAX_BODY} characters. Keep it to a line.`);
  if (pillar === "") problems.push("Say which pillar it serves.");
  if (draft.slotAt !== null && Number.isNaN(Date.parse(draft.slotAt))) problems.push("That slot is not a time.");
  if (problems.length > 0) return { ok: false, message: "Nearly there. These parts still need you:", problems };

  const shell = await getShell();
  if (!shell.workspace) return { ok: false, message: "You are not in a workspace yet.", problems: [] };

  const supabase = await createClient();
  const { data: show, error: showError } = await supabase
    .from("shows")
    .select("id, name, compass")
    .eq("workspace_id", shell.workspace.id)
    .eq("slug", draft.showSlug)
    .maybeSingle();

  if (showError) return { ok: false, message: `It could not be saved: ${showError.message}`, problems: [] };
  if (!show) return { ok: false, message: "That show could not be found.", problems: [] };

  const pillars = pillarsOf(show.compass);
  if (pillars.length === 0) {
    return {
      ok: false,
      message: `${show.name} has no pillars yet, so an idea has nothing to serve. Write the show's vision first.`,
      problems: [],
    };
  }
  if (!pillars.includes(pillar)) {
    return { ok: false, message: `${pillar} is not one of this show's pillars.`, problems: pillars };
  }

  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("ideas")
    .insert({
      workspace_id: shell.workspace.id,
      show_id: show.id,
      pillar,
      body,
      slot_at: draft.slotAt,
      state: "idea",
      created_by: auth.user?.id ?? null,
    })
    .select("id");

  if (error) return { ok: false, message: `It could not be saved: ${error.message}`, problems: [] };
  if (!data || data.length === 0) return { ok: false, message: "You do not have permission to plan in this workspace.", problems: [] };

  revalidatePath("/plan");
  return { ok: true };
}

/** Drops an idea without deleting it, so the board stays honest about what was tried. */
export async function dropIdea(id: string): Promise<SaveResult> {
  const shell = await getShell();
  if (!shell.workspace) return { ok: false, message: "You are not in a workspace yet.", problems: [] };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ideas")
    .update({ state: "dropped" })
    .eq("workspace_id", shell.workspace.id)
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, message: `It could not be dropped: ${error.message}`, problems: [] };
  if (!data || data.length === 0) return { ok: false, message: "You do not have permission to change this idea.", problems: [] };

  revalidatePath("/plan");
  return { ok: true };
}
