"use server";

import { revalidatePath } from "next/cache";
import { BrandKit } from "@mmos/contracts";
import { getShell } from "@/lib/data";
import { problemsFrom, type SaveResult } from "@/lib/save";
import { createClient } from "@/lib/supabase/server";

const FIELDS: Record<string, string> = {
  story: "The story",
  styleWords: "Style words",
  family: "Font name",
  display: "Display font",
  base: "Body font",
  ground: "Background colour",
  accent: "Accent colour",
  ink: "Text colour",
  extra: "Extra colours",
  motion: "How it moves",
  neverDo: "Never do",
  personas: "Who it is for",
  licenceConfirmed: "Font licence",
};

/**
 * Saves one brand's kit. The contract decides what counts as complete, and
 * row-level security decides whether this person may change this brand.
 */
export async function saveBrandKit(slug: string, draft: unknown): Promise<SaveResult> {
  const parsed = BrandKit.safeParse(draft);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Nearly there. These parts still need you:",
      problems: problemsFrom(parsed.error.issues, FIELDS, ["extra", "styleWords", "neverDo"]),
    };
  }

  const shell = await getShell();
  if (!shell.workspace) return { ok: false, message: "You are not in a workspace yet.", problems: [] };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .update({ brand_kit: parsed.data })
    .eq("workspace_id", shell.workspace.id)
    .eq("slug", slug)
    .select("slug");

  if (error) return { ok: false, message: `It could not be saved: ${error.message}`, problems: [] };
  if (!data || data.length === 0) return { ok: false, message: "You do not have permission to change this brand.", problems: [] };

  revalidatePath("/brand");
  revalidatePath("/shows");
  return { ok: true };
}
