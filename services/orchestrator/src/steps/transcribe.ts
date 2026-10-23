import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transcribe, wordCount } from "@mmos/contracts";
import { derivedKey } from "@mmos/media";
import { defineHandler, NonRetryableError } from "../handler";
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

        tooCoarseToCut(result.segments.length, input.durationS);

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

/**
 * A transcript that is one long block is useless to every step after it: `cut`
 * and `clip` seek by time, and cannot cut inside a segment. This happened for
 * real — speaker turns on a one-speaker recording came back as a single
 * twelve-minute utterance — so it is now caught here rather than discovered
 * later as a pile of clips that all start at zero.
 */
const LONGEST_USEFUL_SEGMENT_S = 60;

export function tooCoarseToCut(segmentCount: number, durationS: number): void {
  if (segmentCount === 0) throw new NonRetryableError("The transcript came back empty.");
  const average = durationS / segmentCount;
  if (average > LONGEST_USEFUL_SEGMENT_S) {
    throw new NonRetryableError(
      `The transcript is too coarse to cut from: ${segmentCount} segment(s) across ${Math.round(durationS)} seconds, ` +
        `averaging ${Math.round(average)}s each. Later steps seek by time and cannot cut inside a segment.`,
    );
  }
}
