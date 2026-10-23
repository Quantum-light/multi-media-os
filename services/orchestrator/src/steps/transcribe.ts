import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transcribe, wordCount } from "@mmos/contracts";
import { derivedKey } from "@mmos/media";
import { defineHandler } from "../handler";
import type { Transcriber } from "../transcribe/port";
import type { WorkerStore } from "../storage";

/**
 * Transcribe: turn the small audio file ingest made into words with timings.
 *
 * The transcript goes to R2 rather than into the job row — a long episode runs
 * to hundreds of kilobytes, and every later step reads it. The job keeps only
 * the key and enough counts to see at a glance that it worked.
 */
export function transcribeHandler(store: WorkerStore, transcriber: Transcriber, options: { workRoot?: string } = {}) {
  return defineHandler({
    step: transcribe,
    async run(input, { job, signal }) {
      const dir = await mkdtemp(join(options.workRoot ?? tmpdir(), `transcribe-${job.id}-`));
      try {
        const audio = join(dir, "audio.m4a");
        await store.download(input.audioKey, audio, signal);

        const result = await transcriber.transcribe(audio, {
          ...(input.language ? { language: input.language } : {}),
          ...(signal ? { signal } : {}),
        });

        const transcriptPath = join(dir, "transcript.json");
        await writeFile(transcriptPath, JSON.stringify(result, null, 2), "utf8");
        const transcriptKey = derivedKey(job.workspaceId, job.episodeId, "transcript.json");
        await store.upload(transcriptKey, transcriptPath, "application/json", signal);

        return {
          output: {
            transcriptKey,
            durationS: input.durationS,
            language: result.language,
            segmentCount: result.segments.length,
            wordCount: wordCount(result),
            provider: result.provider,
            model: result.model,
          },
        };
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  });
}
