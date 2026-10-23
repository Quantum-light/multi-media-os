import { createClient } from "@/lib/supabase/server";
import { getShell } from "./shell";
import { cleanPhrase, clock, likePattern, mentionsLabel, occurrences, snippetAround, split, type Snippet } from "./map.build";

/** One place a phrase was said. */
export type MapHit = {
  /** Stable for React, built from where the hit came from. */
  key: string;
  episodeId: string;
  episodeTitle: string;
  showName: string;
  /** "4:12" where the data carries timings, null where it does not. */
  at: string | null;
  /** Set for a moment, so the page can say what kind of moment it was. */
  momentKind: string | null;
  source: "moment" | "transcript";
  /** The sentence around the phrase, already split on it. */
  snippet: Snippet;
  /** "3 mentions here", or null when there is just the one. */
  mentions: string | null;
  recordedAt: string;
};

export type MapData = {
  /** The phrase as searched, which is "" before anyone has searched. */
  query: string;
  hits: MapHit[];
  /** True when the search found more than the cap and stopped counting. */
  capped: boolean;
  limit: number;
  /** What there is to search, so the page can say so before any search. */
  holding: { transcripts: number; words: number; moments: number };
};

/** The most results one search gives back. */
const LIMIT = 50;

type EpisodeNames = Map<string, { title: string; showName: string; createdAt: string }>;

/**
 * Everything she has ever said, searched by words. Transcripts find the
 * episode and the sentence; moments carry real timings. Nothing is guessed:
 * a hit without a timing simply has none.
 */
export async function searchEverything(raw: string | null | undefined): Promise<MapData | null> {
  const shell = await getShell();
  if (!shell.workspace) return null;
  const supabase = await createClient();
  const workspaceId = shell.workspace.id;
  const query = cleanPhrase(raw);

  const holding = await countHolding(supabase, workspaceId);
  if (query === "") return { query, hits: [], capped: false, limit: LIMIT, holding };

  const pattern = likePattern(query);
  const [moments, transcripts] = await Promise.all([
    supabase
      .from("moments")
      .select("id, episode_id, start_s, kind, text")
      .eq("workspace_id", workspaceId)
      .ilike("text", pattern)
      .limit(LIMIT + 1),
    supabase
      .from("transcripts")
      .select("episode_id, text")
      .eq("workspace_id", workspaceId)
      .ilike("text", pattern)
      .limit(LIMIT + 1),
  ]);
  if (moments.error) throw new Error(`The moments could not be searched: ${moments.error.message}`);
  if (transcripts.error) throw new Error(`The transcripts could not be searched: ${transcripts.error.message}`);

  const momentRows = moments.data ?? [];
  const transcriptRows = transcripts.data ?? [];
  const episodeIds = [...new Set([...momentRows, ...transcriptRows].map((r) => r.episode_id))];
  const names = await episodeNames(supabase, workspaceId, episodeIds);

  const hits = [
    ...momentRows.flatMap((row) => momentHit(row, names, query)),
    ...transcriptRows.flatMap((row) => transcriptHit(row, names, query)),
  ].sort(byNewest);

  return { query, hits: hits.slice(0, LIMIT), capped: hits.length > LIMIT, limit: LIMIT, holding };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** How much there is to search. Zero is a real answer. */
async function countHolding(supabase: Supabase, workspaceId: string): Promise<MapData["holding"]> {
  const [transcripts, moments] = await Promise.all([
    supabase.from("transcripts").select("word_count").eq("workspace_id", workspaceId),
    supabase.from("moments").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);
  const rows = transcripts.data ?? [];
  return {
    transcripts: rows.length,
    words: rows.reduce((sum, row) => sum + (row.word_count ?? 0), 0),
    moments: moments.count ?? 0,
  };
}

/** What each hit belongs to. Row-level security already decided what is visible. */
async function episodeNames(supabase: Supabase, workspaceId: string, ids: string[]): Promise<EpisodeNames> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("episodes")
    .select("id, title, created_at, recorded_at, shows(name)")
    .eq("workspace_id", workspaceId)
    .in("id", ids);
  if (error) throw new Error(`The episodes behind those results could not load: ${error.message}`);
  return new Map(
    (data ?? []).map((episode) => [
      episode.id,
      {
        title: episode.title ?? "Untitled",
        showName: episode.shows?.name ?? "No show",
        createdAt: episode.recorded_at ?? episode.created_at,
      },
    ]),
  );
}

type MomentRow = { id: string; episode_id: string; start_s: number; kind: string; text: string };

/** A moment is already one short thing said, so it is shown whole. */
function momentHit(row: MomentRow, names: EpisodeNames, query: string): MapHit[] {
  const episode = names.get(row.episode_id);
  if (!episode) return [];
  const snippet: Snippet = { parts: split(row.text.trim(), query), trimmedStart: false, trimmedEnd: false };
  return [
    {
      key: `moment:${row.id}`,
      episodeId: row.episode_id,
      episodeTitle: episode.title,
      showName: episode.showName,
      at: clock(Number(row.start_s)),
      momentKind: row.kind,
      source: "moment",
      snippet,
      mentions: null,
      recordedAt: episode.createdAt,
    },
  ];
}

type TranscriptRow = { episode_id: string; text: string };

function transcriptHit(row: TranscriptRow, names: EpisodeNames, query: string): MapHit[] {
  const episode = names.get(row.episode_id);
  const snippet = snippetAround(row.text, query);
  if (!episode || !snippet) return [];
  return [
    {
      key: `transcript:${row.episode_id}`,
      episodeId: row.episode_id,
      episodeTitle: episode.title,
      showName: episode.showName,
      at: null,
      momentKind: null,
      source: "transcript",
      snippet,
      mentions: mentionsLabel(occurrences(row.text, query).length),
      recordedAt: episode.createdAt,
    },
  ];
}

/** Newest first, and within one episode the earliest thing said first. */
function byNewest(a: MapHit, b: MapHit): number {
  return b.recordedAt.localeCompare(a.recordedAt) || (a.at ?? "").localeCompare(b.at ?? "");
}
