import { keyInWorkspace } from "@mmos/media";
import { createClient } from "@/lib/supabase/server";
import { signedReadUrl } from "@/lib/uploads/store";
import { getShell } from "./shell";
import { buildAnalysis, buildPieces, whenLabel, type ReviewEpisode, type ReviewListItem } from "./review.build";

export type { ReviewEpisode, ReviewListItem, ReviewPiece } from "./review.build";

/** Episodes waiting at the gate, oldest first. */
export async function getReviewList(): Promise<ReviewListItem[] | null> {
  const shell = await getShell();
  if (!shell.workspace) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("episodes")
    .select("id, title, created_at, flags, shows(name)")
    .eq("workspace_id", shell.workspace.id)
    .eq("state", "review")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Review could not load: ${error.message}`);
  return (data ?? []).map((e) => ({
    id: e.id,
    title: e.title ?? `New ${e.shows?.name ?? "show"} recording`,
    show: e.shows?.name ?? "A show",
    waitingSince: whenLabel(e.created_at, shell.timeZone) ?? "",
    flagged: e.flags.some((f) => f.startsWith("duplicate_of:")),
  }));
}

/** Everything one Review screen needs, in one call. */
export async function getReviewEpisode(episodeId: string): Promise<ReviewEpisode | null> {
  const shell = await getShell();
  if (!shell.workspace) return null;
  const supabase = await createClient();
  const ws = shell.workspace.id;
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? "";

  const [episode, pieces, jobs, preview, plan, role] = await Promise.all([
    supabase.from("episodes").select("id, title, state, flags, shows(name)").eq("id", episodeId).eq("workspace_id", ws).maybeSingle(),
    supabase.from("pieces").select("id, kind, platform, body, version, options, piece_versions(version, body, author, note, created_at)").eq("episode_id", episodeId),
    supabase.from("jobs").select("step, output, created_at").eq("episode_id", episodeId).eq("status", "succeeded").in("step", ["cut", "understand", "clip"]).order("created_at", { ascending: false }),
    supabase.from("media_assets").select("r2_key").eq("episode_id", episodeId).eq("kind", "edit").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.rpc("plan_posts", { p_episode: episodeId }),
    supabase.from("members").select("role").eq("workspace_id", ws).eq("user_id", userId).maybeSingle(),
  ]);
  const firstError = episode.error ?? pieces.error ?? jobs.error ?? preview.error ?? plan.error ?? role.error;
  if (firstError) throw new Error(`Review could not load: ${firstError.message}`);
  if (!episode.data) return null;

  const latest = (step: string) => (jobs.data ?? []).find((j) => j.step === step)?.output ?? null;
  const key = preview.data?.r2_key;
  const previewUrl = key && keyInWorkspace(key, ws) ? await signedReadUrl(key) : null;

  return {
    id: episode.data.id,
    title: episode.data.title ?? "Untitled recording",
    show: episode.data.shows?.name ?? "A show",
    state: episode.data.state,
    flagged: episode.data.flags.some((f) => f.startsWith("duplicate_of:")),
    previewUrl,
    ...buildAnalysis({ cut: latest("cut"), understand: latest("understand"), clip: latest("clip") }),
    pieces: buildPieces(pieces.data ?? []),
    posts: (plan.data ?? []).map((p) => ({ channelId: p.channel_id, platform: p.platform, handle: p.handle, when: whenLabel(p.scheduled_for, shell.timeZone) })),
    canApprove: role.data?.role === "owner" || role.data?.role === "approver",
    chatReady: Boolean(process.env.ANTHROPIC_API_KEY),
  };
}
