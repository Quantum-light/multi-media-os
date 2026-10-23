import { anthropic, reviewChat, type ChatContext, type ChatEdit, type ChatTurn } from "@mmos/agents";
import { UnderstandOutput } from "@mmos/contracts";
import type { StudioClient } from "@/lib/supabase/server";
import { correctionArgs, type CorrectionInput } from "./corrections";

/** Review's writes. Each goes through a definer function that checks the person's role and keeps a version. */

const NOT_YOURS = "You can view this episode but not edit it.";

/**
 * Saves new text for a piece. `save_piece_edit` keeps the version, exactly as
 * `save_piece` always has, and records the change as one correction against the
 * style that produced the text — both in the same transaction, so a correction
 * is never lost from a save.
 */
export async function savePiece(supabase: StudioClient, pieceId: string, body: string, source: "person" | "chat", note?: string): Promise<number> {
  const { data, error } = await supabase.rpc("save_piece_edit", { p_piece: pieceId, p_body: body, p_source: source, ...(note ? { p_note: note } : {}) });
  if (error) throw new Error(error.code === "42501" ? NOT_YOURS : error.message);
  return data;
}

/**
 * Records a correction to anything that is not written text — a cut, a clip, a
 * graphic, a posting time. One door, one record: a new kind of correction calls
 * this, it does not get a table of its own.
 * Answers false when the person changed nothing.
 */
export async function recordCorrection(supabase: StudioClient, input: CorrectionInput): Promise<boolean> {
  const args = correctionArgs(input);
  if (!args) return false;
  const { error } = await supabase.rpc("record_correction", args);
  if (error) throw new Error(error.code === "42501" ? NOT_YOURS : error.message);
  return true;
}

export async function restoreVersion(supabase: StudioClient, pieceId: string, version: number): Promise<number> {
  const { data, error } = await supabase.from("piece_versions").select("body").eq("piece_id", pieceId).eq("version", version).maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "That version no longer exists.");
  return savePiece(supabase, pieceId, data.body, "person", `restored version ${version}`);
}

export async function approveEpisode(supabase: StudioClient, episodeId: string): Promise<number> {
  const { data, error } = await supabase.rpc("approve_episode", { p_episode: episodeId });
  if (error) throw new Error(error.code === "42501" ? "Only an owner or approver can approve." : error.message);
  return data;
}

/** Everything the Review chat may know about the episode, read as the signed-in person. */
async function chatContext(supabase: StudioClient, episodeId: string): Promise<ChatContext> {
  const [episode, pieces, understand, transcript] = await Promise.all([
    supabase.from("episodes").select("title, shows(name, brand_id, brands(voice_kit))").eq("id", episodeId).maybeSingle(),
    supabase.from("pieces").select("id, kind, platform, body, options").eq("episode_id", episodeId),
    supabase.from("jobs").select("output").eq("episode_id", episodeId).eq("step", "understand").eq("status", "succeeded").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("transcripts").select("text").eq("episode_id", episodeId).maybeSingle(),
  ]);
  const err = episode.error ?? pieces.error ?? understand.error ?? transcript.error;
  if (err) throw new Error(err.message);
  if (!episode.data) throw new Error("Episode not found");
  const brandId = episode.data.shows?.brand_id;
  // The voice lessons are a reading of the one record of a correction, not a second record of it.
  const lessons = brandId
    ? await supabase.from("voice_lesson_feed").select("piece_kind, platform, before, after").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(20)
    : { data: [] };
  const u = UnderstandOutput.safeParse(understand.data?.output);
  return {
    showName: episode.data.shows?.name ?? "the show",
    episodeTitle: episode.data.title ?? "Untitled",
    summary: u.success ? u.data.summary : "",
    moments: u.success ? u.data.moments.map((m) => m.quote) : [],
    transcript: transcript.data?.text ?? "",
    pieces: (pieces.data ?? []).map((p) => ({ id: p.id, kind: p.kind as ChatContext["pieces"][number]["kind"], platform: p.platform, body: p.body, options: p.options })),
    voiceKit: episode.data.shows?.brands?.voice_kit ?? null,
    voiceLessons: (lessons.data ?? []).map((l) => ({ pieceKind: l.piece_kind ?? "", platform: l.platform, before: l.before ?? "", after: l.after ?? "" })),
  };
}

export const CHAT_NOT_READY = "The Review chat needs ANTHROPIC_API_KEY in the Studio's settings (Vercel).";

export async function chat(supabase: StudioClient, episodeId: string, history: ChatTurn[]): Promise<{ reply: string; edits: ChatEdit[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { reply: CHAT_NOT_READY, edits: [] };
  const llm = anthropic({ apiKey, ...(process.env.ANTHROPIC_MODEL ? { model: process.env.ANTHROPIC_MODEL } : {}) });
  const ctx = await chatContext(supabase, episodeId);
  const { reply, edits } = await reviewChat(llm, ctx, history, (pieceId, body, note) => savePiece(supabase, pieceId, body, "chat", note));
  return { reply, edits };
}
