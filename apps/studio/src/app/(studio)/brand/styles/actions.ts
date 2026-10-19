"use server";

import { revalidatePath } from "next/cache";
import { StyleDoc } from "@mmos/contracts";
import { getShell } from "@/lib/data";
import { problemsFrom, type SaveResult } from "@/lib/save";
import { createClient } from "@/lib/supabase/server";

const FIELDS: Record<string, string> = {
  slug: "The short name",
  name: "The name",
  kind: "What it styles",
  prompt: "The instruction",
  useWhen: "When to use it",
  palette: "Colours",
  neverDo: "Never do",
  aspect: "Shape",
  pace: "Pace",
};

const DUPLICATE = "23505";

/**
 * Saves one style, new or changed. `slug` identifies it inside the workspace,
 * so renaming the short name of an existing style moves it.
 */
export async function saveStyle(previousSlug: string | null, brandSlug: string, draft: unknown): Promise<SaveResult> {
  const parsed = StyleDoc.safeParse(draft);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Nearly there. These parts still need you:",
      problems: problemsFrom(parsed.error.issues, FIELDS, ["palette", "neverDo"]),
    };
  }

  const shell = await getShell();
  if (!shell.workspace) return { ok: false, message: "You are not in a workspace yet.", problems: [] };
  const ws = shell.workspace.id;
  const supabase = await createClient();

  const brandId = await findBrandId(supabase, ws, brandSlug);
  if (brandId === "missing") return { ok: false, message: "That brand is no longer in this workspace.", problems: [] };

  const style = parsed.data;
  const row = {
    workspace_id: ws,
    brand_id: brandId,
    slug: style.slug,
    name: style.name,
    kind: style.kind,
    prompt: style.prompt,
    never_do: style.neverDo,
    recipe: style.recipe,
  };

  const written =
    previousSlug === null
      ? await supabase.from("styles").insert(row).select("slug")
      : await supabase.from("styles").update(row).eq("workspace_id", ws).eq("slug", previousSlug).select("slug");

  if (written.error) {
    if (written.error.code === DUPLICATE) {
      return { ok: false, message: `There is already a style with the short name "${style.slug}". Give this one its own.`, problems: [] };
    }
    return { ok: false, message: `It could not be saved: ${written.error.message}`, problems: [] };
  }
  if (!written.data || written.data.length === 0) {
    return { ok: false, message: "You do not have permission to change styles in this workspace.", problems: [] };
  }

  revalidatePath("/brand/styles");
  return { ok: true };
}

/** Retiring a style keeps every episode that used it readable. Nothing is deleted. */
export async function setArchived(slug: string, archived: boolean): Promise<SaveResult> {
  const shell = await getShell();
  if (!shell.workspace) return { ok: false, message: "You are not in a workspace yet.", problems: [] };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("styles")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("workspace_id", shell.workspace.id)
    .eq("slug", slug)
    .select("slug");

  if (error) return { ok: false, message: `It could not be changed: ${error.message}`, problems: [] };
  if (!data || data.length === 0) return { ok: false, message: "You do not have permission to change this style.", problems: [] };

  revalidatePath("/brand/styles");
  return { ok: true };
}

type Client = Awaited<ReturnType<typeof createClient>>;

/** "" means the style belongs to the whole workspace rather than one brand. */
async function findBrandId(supabase: Client, workspaceId: string, brandSlug: string): Promise<string | null | "missing"> {
  if (brandSlug === "") return null;
  const { data } = await supabase.from("brands").select("id").eq("workspace_id", workspaceId).eq("slug", brandSlug).maybeSingle();
  return data ? data.id : "missing";
}
