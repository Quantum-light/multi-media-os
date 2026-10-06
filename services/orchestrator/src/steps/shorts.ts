import { clip, CutOutput, storyboard, UnderstandOutput, WriteOutput } from "@mmos/contracts";
import { planClips, planCues } from "../edit/shorts-plan";
import { priorOutput, type EpisodeReader } from "../episode";
import { defineHandler } from "../handler";

/** Clip (specs/steps/clip.md): short-form candidates from the moments. Video shows only. */
export function clipHandler(deps: { reader: EpisodeReader }) {
  return defineHandler({
    step: clip,
    async run(_input, { job }) {
      const [u, c] = await Promise.all([
        priorOutput(deps.reader, job.episodeId, "understand", UnderstandOutput),
        priorOutput(deps.reader, job.episodeId, "cut", CutOutput),
      ]);
      return { output: { clips: planClips(u.moments, c.cuts, c.durationS) } };
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
