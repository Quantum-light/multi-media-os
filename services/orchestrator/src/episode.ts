import type postgres from "postgres";
import { Platform, type StepName } from "@mmos/contracts";

type Sql = ReturnType<typeof postgres>;

/** A change a person (or the Review chat) made to a draft: the voice kit learns from these. */
export type VoiceLesson = { pieceKind: string; platform: string | null; before: string; after: string };

/** What the writing steps need to know about the show an episode belongs to. */
export type ShowContext = {
  showName: string;
  kind: "podcast" | "video" | "both";
  brandName: string;
  /** The show's Vision (falls back to the brand's): mission, pillars, vision. Free-form JSON from the Studio. */
  compass: Record<string, unknown> | null;
  voiceKit: Record<string, unknown> | null;
  voiceLessons: VoiceLesson[];
  /** Platforms the show's channels publish to, e.g. youtube, instagram, threads. */
  platforms: Platform[];
};

/**
 * Read-only view of an episode for handlers. Steps receive the previous step's output as
 * input; anything older (the cut list, the moments) or about the show comes from here.
 */
export interface EpisodeReader {
  show(episodeId: string): Promise<ShowContext>;
  /** The saved output of the latest successful run of a step for this episode, or null. */
  stepOutput(episodeId: string, step: StepName): Promise<unknown>;
}

const asObject = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

export class PgEpisodeReader implements EpisodeReader {
  constructor(private readonly sql: Sql) {}

  async show(episodeId: string): Promise<ShowContext> {
    const [row] = await this.sql<{ show_name: string; kind: string; brand_id: string; brand_name: string; show_compass: unknown; brand_compass: unknown; voice_kit: unknown; show_id: string }[]>`
      select s.id as show_id, s.name as show_name, s.kind, b.id as brand_id, b.name as brand_name,
             s.compass as show_compass, b.compass as brand_compass, b.voice_kit
      from public.episodes e join public.shows s on s.id = e.show_id join public.brands b on b.id = s.brand_id
      where e.id = ${episodeId}`;
    if (!row) throw new Error(`Episode ${episodeId} has no show`);
    const lessons = await this.sql<{ piece_kind: string; platform: string | null; before: string; after: string }[]>`
      select piece_kind, platform, before, after from public.voice_lessons
      where brand_id = ${row.brand_id} order by created_at desc limit 20`;
    const channels = await this.sql<{ platform: string }[]>`
      select distinct c.platform from public.show_channels sc join public.channels c on c.id = sc.channel_id
      where sc.show_id = ${row.show_id} and c.status = 'connected'`;
    return {
      showName: row.show_name,
      kind: row.kind === "podcast" || row.kind === "both" ? row.kind : "video",
      brandName: row.brand_name,
      compass: asObject(row.show_compass) ?? asObject(row.brand_compass),
      voiceKit: asObject(row.voice_kit),
      voiceLessons: lessons.map((l) => ({ pieceKind: l.piece_kind, platform: l.platform, before: l.before, after: l.after })),
      platforms: channels.flatMap((c) => {
        const p = Platform.safeParse(c.platform);
        return p.success ? [p.data] : [];
      }),
    };
  }

  async stepOutput(episodeId: string, step: StepName): Promise<unknown> {
    const [row] = await this.sql<{ output: unknown }[]>`
      select output from public.jobs where episode_id = ${episodeId} and step = ${step} and status = 'succeeded'
      order by created_at desc limit 1`;
    return row?.output ?? null;
  }
}

/** Reads a step's saved output and checks it against that step's contract. */
export async function priorOutput<T>(reader: EpisodeReader, episodeId: string, step: StepName, schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }): Promise<T> {
  const raw = await reader.stepOutput(episodeId, step);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error(`The ${step} result for this episode is missing or out of date`);
  return parsed.data;
}
