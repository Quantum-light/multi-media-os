import { LlmRefused, runFindClips, type Llm } from "@mmos/agents";
import { clip, CutOutput, storyboard, UnderstandOutput, WriteOutput } from "@mmos/contracts";
import type { ClipSlateWriter } from "../clips/store";
import { selectClips } from "../clips/select";
import { planCues } from "../edit/shorts-plan";
import { priorOutput, type EpisodeReader, type ShowContext } from "../episode";
import { defineHandler, NonRetryableError } from "../handler";
import type { WorkerStore } from "../storage";
import { loadTranscript } from "./transcribe";

/** What Grace wants a week from each kind of show until a show says otherwise. */
export const DEFAULT_CLIP_TARGET = { video: 21, podcast: 12 } as const;

/**
 * How many shorts this episode's show wants. The show decides when it says so; otherwise
 * its kind does, and a show that is both counts as a video show.
 *
 * TODO: this wants to become a per-show setting — a `clips_per_episode` column on
 * public.shows, read into `ShowContext` by `PgEpisodeReader`. The settings lookup below is
 * the seam for it, so the only change then is where the number comes from.
 */
export function clipTarget(show: ShowContext): number {
  const settings = (show as ShowContext & { settings?: unknown }).settings;
  const said = settings && typeof settings === "object" && !Array.isArray(settings) ? (settings as Record<string, unknown>).clipsPerEpisode : undefined;
  if (typeof said === "number" && Number.isInteger(said) && said > 0) return said;
  return show.kind === "podcast" ? DEFAULT_CLIP_TARGET.podcast : DEFAULT_CLIP_TARGET.video;
}

/**
 * Clip (specs/steps/clip.md): the finder. The model proposes candidates against Grace's
 * four signals, `selectClips` decides the slate, and the slate is written to public.clips.
 * The step's own result is only the shape of it: the target, what was offered, and the
 * shortfall when the episode did not have the show's number in it.
 */
export function clipHandler(deps: { reader: EpisodeReader; store: WorkerStore; llm: Llm; clips: ClipSlateWriter }) {
  return defineHandler({
    step: clip,
    async run(_input, { job, signal }) {
      const [u, c, show] = await Promise.all([
        priorOutput(deps.reader, job.episodeId, "understand", UnderstandOutput),
        priorOutput(deps.reader, job.episodeId, "cut", CutOutput),
        deps.reader.show(job.episodeId),
      ]);
      const doc = await loadTranscript(deps.store, u.transcriptKey, signal);
      const target = clipTarget(show);

      // A refused key or a malformed request will not fix itself: fail at once instead of retrying.
      const found = await runFindClips(deps.llm, show, doc, c.cuts, target, signal).catch((e: unknown) => {
        if (e instanceof LlmRefused) throw new NonRetryableError(e.message);
        throw e;
      });

      const plan = selectClips(found.candidates, { target });
      await deps.clips.save({ workspaceId: job.workspaceId, episodeId: job.episodeId, jobId: job.id }, plan);
      return {
        output: {
          target,
          proposed: found.candidates.length,
          chosen: plan.chosen.length,
          reserve: plan.reserve.length,
          shortfall: plan.shortfall,
          model: deps.llm.model,
        },
        costPence: found.costPence,
      };
    },
  });
}

/** Storyboard (specs/steps/storyboard.md): where the brand graphics go. Video shows only. */
export function storyboardHandler(deps: { reader: EpisodeReader }) {
  return defineHandler({
    step: storyboard,
    async run(_input, { job }) {
      const [u, c, w, show] = await Promise.all([
        priorOutput(deps.reader, job.episodeId, "understand", UnderstandOutput),
        priorOutput(deps.reader, job.episodeId, "cut", CutOutput),
        priorOutput(deps.reader, job.episodeId, "write", WriteOutput),
        deps.reader.show(job.episodeId),
      ]);
      const cues = planCues({ showName: show.showName, chapters: w.chapters, moments: u.moments, cuts: c.cuts, editedDurationS: c.keptS });
      return { output: { cues, editedDurationS: c.keptS } };
    },
  });
}
