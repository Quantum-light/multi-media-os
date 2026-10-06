"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Compass } from "@mmos/contracts";
import { createClient } from "@/lib/supabase/server";
import { getShell } from "@/lib/data";

export type SaveResult = { ok: true } | { ok: false; message: string; problems: string[] };

const FIELDS: Record<string, string> = {
  whatItIs: "What it is, in one line",
  mission: "Mission",
  vision: "Vision",
  pillars: "Core pillars",
  statement: "The main goal",
  by: "The date to reach it by",
  title: "Objective name",
  name: "What the number measures",
  current: "Where it is now",
  target: "Where it is going",
  evidenceSource: "Where the number comes from",
  objectives: "The three objectives",
  kpis: "Numbers for this objective",
};

const ORDINALS = ["first", "second", "third"];

/** Turns a contract complaint into a sentence a person can act on. */
function readable(issue: z.ZodIssue): string {
  const path = issue.path.filter((p) => typeof p === "string") as string[];
  const index = issue.path.find((p) => typeof p === "number");
  const field = FIELDS[path[path.length - 1] ?? ""] ?? path.join(" ");
  const where = typeof index === "number" && path.includes("objectives") ? ` (${ORDINALS[index] ?? `${index + 1}th`} objective)` : "";
  if (issue.code === "invalid_type" || issue.message.toLowerCase().includes("required")) return `${field}${where} is still empty.`;
  if (issue.code === "too_small") return `${field}${where} needs something in it.`;
  if (issue.code === "too_big") return `${field}${where} has too many.`;
  if (path.includes("by")) return "The date needs to be a real date.";
  return `${field}${where}: ${issue.message.toLowerCase()}`;
}

/**
 * Saves one show's vision. The contract decides what counts as complete, and
 * row-level security decides whether this person may change this show.
 */
export async function saveCompass(slug: string, draft: unknown): Promise<SaveResult> {
  const parsed = Compass.safeParse(draft);
  if (!parsed.success) {
    const problems = [...new Set(parsed.error.issues.map(readable))].slice(0, 6);
    return { ok: false, message: "Nearly there. These parts still need you:", problems };
  }

  const shell = await getShell();
  if (!shell.workspace) return { ok: false, message: "You are not in a workspace yet.", problems: [] };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shows")
    .update({ compass: parsed.data })
    .eq("workspace_id", shell.workspace.id)
    .eq("slug", slug)
    .select("slug");

  if (error) return { ok: false, message: `It could not be saved: ${error.message}`, problems: [] };
  if (!data || data.length === 0) return { ok: false, message: "You do not have permission to change this show.", problems: [] };

  revalidatePath("/vision");
  return { ok: true };
}
