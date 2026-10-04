import { createClient } from "@/lib/supabase/server";
import { r2Store } from "@/lib/uploads/store";
import { getShell } from "./shell";

export type UploadTargets = { shows: { id: string; name: string; kind: string }[]; storageReady: boolean };

/** Shows a recording can be uploaded to, and whether storage is connected. */
export async function getUploadTargets(): Promise<UploadTargets | null> {
  const shell = await getShell();
  if (!shell.workspace) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("shows").select("id, name, kind").eq("workspace_id", shell.workspace.id).order("created_at");
  if (error) throw new Error(`Shows could not load: ${error.message}`);
  return { shows: data ?? [], storageReady: r2Store() !== null };
}
