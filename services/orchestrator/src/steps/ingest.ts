import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ingest } from "@mmos/contracts";
import { derivedKey } from "@mmos/media";
import { defineHandler, NonRetryableError } from "../handler";
import { extractAudio, makeProxy } from "../media/derive";
import { probe } from "../media/probe";
import type { WorkerStore } from "../storage";

/**
 * Ingest (specs/steps/ingest.md): read the source once, then make the small audio file
 * and the 540p preview at the same time, and store both next to the source.
 */
export function ingestHandler(store: WorkerStore, options: { workRoot?: string } = {}) {
  return defineHandler({
    step: ingest,
    async run(input, { job, signal }) {
      const dir = await mkdtemp(join(options.workRoot ?? tmpdir(), `ingest-${job.id}-`));
      try {
        const source = join(dir, "source");
        const { sha256, bytes } = await store.download(input.key, source, signal);
        if (bytes !== input.bytes) throw new Error(`Downloaded ${bytes} bytes, expected ${input.bytes}`);

        const facts = await probe(source, signal);
        if (!facts.hasAudio) throw new NonRetryableError("The recording has no sound, so it cannot be transcribed");

        const audioPath = join(dir, "audio.m4a");
        const proxyPath = join(dir, "proxy.mp4");
        await Promise.all([
          extractAudio(source, audioPath, signal),
          facts.video ? makeProxy(source, proxyPath, true, signal) : Promise.resolve(""),
        ]);

        const audioKey = derivedKey(job.workspaceId, job.episodeId, "audio.m4a");
        const proxyKey = facts.video ? derivedKey(job.workspaceId, job.episodeId, "proxy-540p.mp4") : null;
        await Promise.all([
          store.upload(audioKey, audioPath, "audio/mp4", signal),
          proxyKey ? store.upload(proxyKey, proxyPath, "video/mp4", signal) : Promise.resolve(),
        ]);

        return { output: { sha256, durationS: facts.durationS, video: facts.video, audioKey, proxyKey } };
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  });
}
