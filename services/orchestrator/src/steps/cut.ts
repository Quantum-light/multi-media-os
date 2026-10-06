import { cut } from "@mmos/contracts";
import { planCuts, removedSeconds } from "../edit/cut-plan";
import { defineHandler } from "../handler";
import type { WorkerStore } from "../storage";
import { loadTranscript } from "./transcribe";

/** Cut (specs/steps/cut.md): a cut list from word timings. No re-encode, no paid call. */
export function cutHandler(deps: { store: WorkerStore }) {
  return defineHandler({
    step: cut,
    async run(input, { signal }) {
      const doc = await loadTranscript(deps.store, input.transcriptKey, signal);
      const cuts = planCuts(doc.words, doc.durationS);
      const removedS = removedSeconds(cuts);
      return { output: { transcriptKey: input.transcriptKey, durationS: doc.durationS, cuts, removedS, keptS: Math.max(0.01, Math.round((doc.durationS - removedS) * 100) / 100) } };
    },
  });
}
