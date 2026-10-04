import type { StudioClient } from "@/lib/supabase/server";
import type { UploadDb } from "./service";

/** UploadDb on Supabase, acting as the signed-in person (RLS applies to every call). */
export function supabaseUploadDb(supabase: StudioClient): UploadDb {
  const fail = (what: string, message: string): never => {
    throw new Error(`${what}: ${message}`);
  };
  return {
    async showWorkspace(showId) {
      const { data, error } = await supabase.from("shows").select("workspace_id").eq("id", showId).maybeSingle();
      if (error) fail("Show lookup", error.message);
      return data?.workspace_id ?? null;
    },
    async findDuplicate(workspaceId, quickFingerprint) {
      const { data, error } = await supabase
        .from("media_assets")
        .select("episode_id, created_at, episodes(title)")
        .eq("workspace_id", workspaceId)
        .eq("kind", "source")
        .eq("quick_fingerprint", quickFingerprint)
        .not("episode_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) fail("Duplicate check", error.message);
      if (!data?.episode_id) return null;
      return { episodeId: data.episode_id, title: data.episodes?.title ?? null, createdAt: data.created_at };
    },
    async createEpisode(workspaceId, showId, title) {
      const { data, error } = await supabase.from("episodes").insert({ workspace_id: workspaceId, show_id: showId, title, state: "uploading" }).select("id").single();
      if (error || !data) return fail("Creating the episode", error?.message ?? "no row");
      return data.id;
    },
    async createSourceAsset(input) {
      const { data, error } = await supabase
        .from("media_assets")
        .insert({ workspace_id: input.workspaceId, episode_id: input.episodeId, kind: "source", r2_key: input.key, bytes: input.bytes, quick_fingerprint: input.quickFingerprint })
        .select("id")
        .single();
      if (error || !data) return fail("Recording the upload", error?.message ?? "no row");
      return data.id;
    },
    async getAsset(assetId) {
      const { data, error } = await supabase.from("media_assets").select("id, workspace_id, episode_id, r2_key, bytes").eq("id", assetId).eq("kind", "source").maybeSingle();
      if (error) fail("Upload lookup", error.message);
      if (!data || !data.episode_id || data.bytes === null) return null;
      return { id: data.id, workspaceId: data.workspace_id, episodeId: data.episode_id, key: data.r2_key, bytes: data.bytes };
    },
    async startIngest(episodeId) {
      const { error } = await supabase.rpc("start_ingest", { p_episode: episodeId });
      if (error) fail("Starting the edit", error.message);
    },
    async discardEpisode(episodeId) {
      const { error } = await supabase.from("episodes").delete().eq("id", episodeId).eq("state", "uploading");
      if (error) fail("Removing the unfinished upload", error.message);
    },
  };
}
