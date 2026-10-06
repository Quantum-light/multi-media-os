import { LlmRefused, runUnderstand, runWrite, type Llm } from "@mmos/agents";
import { CutOutput, UnderstandOutput, understand, write } from "@mmos/contracts";
import { priorOutput, type EpisodeReader } from "../episode";
import { defineHandler, NonRetryableError } from "../handler";
import type { WorkerStore } from "../storage";
import { loadTranscript } from "./transcribe";

type Deps = { store: WorkerStore; reader: EpisodeReader; llm: Llm };

/** A refused key or malformed request will not fix itself: fail at once instead of retrying. */
async function guard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (e) {
    if (e instanceof LlmRefused) throw new NonRetryableError(e.message);
    throw e;
  }
}

/** Understand (specs/steps/understand.md): chapters, moments, themes and pillar matches. */
export function understandHandler(deps: Deps) {
  return defineHandler({
    step: understand,
    async run(input, { job, signal }) {
      const [doc, show] = await Promise.all([loadTranscript(deps.store, input.transcriptKey, signal), deps.reader.show(job.episodeId)]);
      const res = await guard(() => runUnderstand(deps.llm, show, doc, input.cuts, signal));
      return {
        output: { ...res.understanding, transcriptKey: input.transcriptKey, durationS: input.durationS, model: deps.llm.model },
        costPence: res.costPence,
      };
    },
  });
}

/** Write (specs/steps/write.md): titles, description, chapters and captions in the brand voice. */
export function writeHandler(deps: Omit<Deps, "store">) {
  return defineHandler({
    step: write,
    async run(input, { job, signal }) {
      const [cuts, show] = await Promise.all([priorOutput(deps.reader, job.episodeId, "cut", CutOutput), deps.reader.show(job.episodeId)]);
      const understanding = UnderstandOutput.parse(input);
      const res = await guard(() => runWrite(deps.llm, show, understanding, cuts.cuts, cuts.keptS, signal));
      return { output: res.output, costPence: res.costPence };
    },
  });
}
