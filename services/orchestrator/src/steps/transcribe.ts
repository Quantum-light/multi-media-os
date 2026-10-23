import { TranscriptDoc, transcribe } from "@mmos/contracts";
import { derivedKey } from "@mmos/media";
import type { EpisodeReader, ShowContext } from "../episode";
import { defineHandler } from "../handler";
import type { Transcriber } from "../providers/assemblyai";
import type { WorkerStore } from "../storage";

/** Long enough for a busy transcription queue to reach the file. */
const LINK_SECONDS = 6 * 3600;

/** Names the transcriber should spell right: the show, the brand, the host's handle. */
export function keytermsFor(show: Pick<ShowContext, "showName" | "brandName">): string[] {
  const terms = new Set<string>([show.showName, show.brandName]);
  for (const part of `${show.showName} ${show.brandName}`.split(/\s+/)) if (/^[A-Z]{2,}$/.test(part)) terms.add(part);
  return [...terms].filter((t) => t.length >= 2 && t.length <= 50);
}

export async function loadTranscript(store: WorkerStore, key: string, signal?: AbortSignal): Promise<TranscriptDoc> {
  return TranscriptDoc.parse(JSON.parse(await store.readText(key, signal)));
}

/**
 * Transcribe (specs/steps/transcribe.md): AssemblyAI fetches only the small audio file
 * through a short-lived link; the full transcript goes to storage, the summary to the job.
 */
export function transcribeHandler(deps: { store: WorkerStore; reader: EpisodeReader; transcriber: Transcriber; pencePerHour?: number }) {
  return defineHandler({
    step: transcribe,
    async run(input, { job, signal }) {
      const show = await deps.reader.show(job.episodeId);
      const audioUrl = await deps.store.signedGetUrl(input.audioKey, LINK_SECONDS);
      const result = await deps.transcriber.transcribe({ audioUrl, keyterms: keytermsFor(show), signal });
      const doc = TranscriptDoc.parse({ version: 1, ...result });

      const transcriptKey = derivedKey(job.workspaceId, job.episodeId, "transcript.json");
      await deps.store.writeText(transcriptKey, JSON.stringify(doc), "application/json", signal);

      const speakers = [...new Set(doc.words.map((w) => w.speaker).filter((s): s is string => !!s))];
      const text = doc.utterances.length ? doc.utterances.map((u) => `${u.speaker}: ${u.text}`).join("\n") : doc.words.map((w) => w.text).join(" ");
      return {
        output: { transcriptKey, provider: doc.provider, providerRef: doc.providerRef, language: doc.language, durationS: doc.durationS, wordCount: doc.words.length, speakers, text },
        costPence: Math.ceil((doc.durationS / 3600) * (deps.pencePerHour ?? 25)),
      };
    },
  });
}
