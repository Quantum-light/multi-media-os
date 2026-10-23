import { stepsFor, type StepName } from "@mmos/contracts";
import { createClient } from "@/lib/supabase/server";
import { getShell } from "./shell";

export type EpisodeRow = {
  id: string;
  title: string;
  showName: string;
  showSlug: string;
  showKind: string;
  state: string;
  flags: string[];
  createdAt: string;
  /** Where it has got to, and whether anything stopped. */
  stepLabel: string;
  stopped: boolean;
};

export type EpisodeStep = {
  step: StepName;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "not started";
  attempts: number;
  error: string | null;
  at: string | null;
  /** Set once the step has produced something worth reading. */
  output: Record<string, unknown> | null;
};

export type EpisodeFile = { kind: string; key: string; bytes: number | null; durationS: number | null; createdAt: string };

export type EpisodeDetail = {
  id: string;
  title: string;
  state: string;
  flags: string[];
  createdAt: string;
  show: { name: string; slug: string; kind: string };
  steps: EpisodeStep[];
  files: EpisodeFile[];
  /** Null until transcribe has succeeded. */
  transcript: { key: string; words: number; segments: number; language: string } | null;
};

/** Every recording in the workspace, newest first. The library, not the approval gate. */
export async function getEpisodes(): Promise<EpisodeRow[] | null> {
  const shell = await getShell();
  if (!shell.workspace) return null;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("episodes")
    .select("id, title, state, flags, created_at, shows(name, slug, kind)")
    .eq("workspace_id", shell.workspace.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Episodes could not load: ${error.message}`);
  if (!data || data.length === 0) return [];

  const { data: jobs } = await supabase
    .from("jobs")
    .select("episode_id, step, status, created_at")
    .in("episode_id", data.map((e) => e.id));

  return data.map((episode) => {
    const mine = (jobs ?? []).filter((j) => j.episode_id === episode.id);
    const latest = [...mine].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return {
      id: episode.id,
      title: episode.title ?? "Untitled",
      showName: episode.shows?.name ?? "No show",
      showSlug: episode.shows?.slug ?? "",
      showKind: episode.shows?.kind ?? "video",
      state: episode.state,
      flags: episode.flags,
      createdAt: episode.created_at,
      stepLabel: latest ? latest.step : "waiting to start",
      stopped: latest?.status === "failed",
    };
  });
}

/** One recording: where every step got to, what it produced, and what is on disk. */
export async function getEpisode(id: string): Promise<EpisodeDetail | null> {
  const shell = await getShell();
  if (!shell.workspace) return null;
  const supabase = await createClient();

  const { data: episode, error } = await supabase
    .from("episodes")
    .select("id, title, state, flags, created_at, shows(name, slug, kind)")
    .eq("workspace_id", shell.workspace.id)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`That episode could not load: ${error.message}`);
  if (!episode) return null;

  const [jobs, assets] = await Promise.all([
    supabase.from("jobs").select("step, status, attempts, error, created_at, output").eq("episode_id", id).order("created_at"),
    supabase.from("media_assets").select("kind, r2_key, bytes, duration_s, created_at").eq("episode_id", id).order("created_at"),
  ]);
  if (jobs.error) throw new Error(`The steps could not load: ${jobs.error.message}`);

  const kind = episode.shows?.kind ?? "video";
  const planned = stepsFor(kind === "podcast" || kind === "both" ? kind : "video");

  const steps: EpisodeStep[] = planned.map((step) => {
    const job = [...(jobs.data ?? [])].reverse().find((j) => j.step === step);
    if (!job) return { step, status: "not started", attempts: 0, error: null, at: null, output: null };
    return {
      step,
      status: asStatus(job.status),
      attempts: job.attempts,
      error: job.error,
      at: job.created_at,
      output: asRecord(job.output),
    };
  });

  const transcribed = steps.find((s) => s.step === "transcribe" && s.status === "succeeded")?.output ?? null;
  const key = typeof transcribed?.["transcriptKey"] === "string" ? (transcribed["transcriptKey"] as string) : null;

  return {
    id: episode.id,
    title: episode.title ?? "Untitled",
    state: episode.state,
    flags: episode.flags,
    createdAt: episode.created_at,
    show: { name: episode.shows?.name ?? "No show", slug: episode.shows?.slug ?? "", kind },
    steps,
    files: (assets.data ?? []).map((a) => ({ kind: a.kind, key: a.r2_key, bytes: a.bytes, durationS: a.duration_s === null ? null : Number(a.duration_s), createdAt: a.created_at })),
    transcript: key
      ? {
          key,
          words: Number(transcribed?.["wordCount"] ?? 0),
          segments: Number(transcribed?.["segmentCount"] ?? 0),
          language: String(transcribed?.["language"] ?? "en"),
        }
      : null,
  };
}

function asStatus(status: string): EpisodeStep["status"] {
  return status === "queued" || status === "running" || status === "succeeded" || status === "failed" || status === "cancelled" ? status : "not started";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
