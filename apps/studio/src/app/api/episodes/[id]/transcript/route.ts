import { NextResponse } from "next/server";
import { Transcript } from "@mmos/contracts";
import { keyInWorkspace } from "@mmos/media";
import { createClient } from "@/lib/supabase/server";
import { r2Store, storageProblem } from "@/lib/uploads/store";

/** A transcript of a long episode. Generous, but not unbounded. */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Serves one episode's transcript. Row-level security decides whether the
 * signed-in person may see the episode at all; the key is then checked against
 * that workspace, so a tampered key cannot reach another tenant's storage.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ message: "Sign in again." }, { status: 401 });

  const { data: episode } = await supabase.from("episodes").select("id, workspace_id").eq("id", id).maybeSingle();
  if (!episode) return NextResponse.json({ message: "That episode was not found." }, { status: 404 });

  const { data: job } = await supabase
    .from("jobs")
    .select("output")
    .eq("episode_id", id)
    .eq("step", "transcribe")
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const output = job?.output;
  const key = output !== null && typeof output === "object" && !Array.isArray(output) && typeof (output as Record<string, unknown>)["transcriptKey"] === "string"
    ? ((output as Record<string, unknown>)["transcriptKey"] as string)
    : null;
  if (!key) return NextResponse.json({ message: "This episode has not been transcribed yet." }, { status: 404 });
  if (!keyInWorkspace(key, episode.workspace_id)) return NextResponse.json({ message: "That transcript was not found." }, { status: 404 });

  const store = r2Store();
  if (!store) return NextResponse.json({ message: storageProblem() }, { status: 503 });

  const body = await store.readText(key, MAX_BYTES);
  if (body === null) return NextResponse.json({ message: "The transcript could not be read from storage." }, { status: 502 });

  const parsed = Transcript.safeParse(JSON.parse(body) as unknown);
  if (!parsed.success) return NextResponse.json({ message: "The stored transcript is not in a shape this Studio understands." }, { status: 502 });

  return NextResponse.json(parsed.data);
}
