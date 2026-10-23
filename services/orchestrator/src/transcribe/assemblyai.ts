import { readFile } from "node:fs/promises";
import { Transcript } from "@mmos/contracts";
import { NonRetryableError } from "../handler";
import type { Transcriber } from "./port";

const BASE = "https://api.assemblyai.com/v2";
const POLL_MS = 3_000;

type Utterance = { start: number; end: number; text: string; speaker?: string | null; confidence?: number | null };
type Job = { id: string; status: string; error?: string | null; language_code?: string | null; audio_duration?: number | null; utterances?: Utterance[] | null; words?: Utterance[] | null };

/**
 * AssemblyAI. Reads its key from the environment at call time, so the worker
 * starts and reports the step as unavailable rather than crashing on boot when
 * the key has not been added yet.
 */
export function assemblyAiTranscriber(env: NodeJS.ProcessEnv = process.env): Transcriber {
  return {
    name: "assemblyai",
    async transcribe(audio, { language, signal }) {
      const key = (env["ASSEMBLYAI_API_KEY"] ?? "").trim();
      if (key === "") throw new NonRetryableError("ASSEMBLYAI_API_KEY is not set in Railway, so nothing can be transcribed yet.");

      const uploadUrl = await upload(key, audio, signal);
      const created = await post<Job>(key, "/transcript", { audio_url: uploadUrl, speaker_labels: true, ...(language ? { language_code: language } : { language_detection: true }) }, signal);
      const done = await waitFor(key, created.id, signal);

      const utterances = done.utterances ?? done.words ?? [];
      if (utterances.length === 0) throw new NonRetryableError("The recording produced no words. It may be silent or music only.");

      return Transcript.parse({
        language: done.language_code ?? language ?? "en",
        durationS: done.audio_duration && done.audio_duration > 0 ? done.audio_duration : seconds(utterances),
        provider: "assemblyai",
        model: null,
        segments: utterances.map((u) => ({
          startS: u.start / 1000,
          endS: u.end / 1000,
          text: u.text,
          speaker: u.speaker ?? null,
          confidence: u.confidence ?? null,
        })),
      });
    },
  };
}

async function upload(key: string, path: string, signal?: AbortSignal): Promise<string> {
  const body = await readFile(path);
  const response = await fetch(`${BASE}/upload`, { method: "POST", headers: { authorization: key }, body, ...(signal ? { signal } : {}) });
  if (!response.ok) throw await failure(response, "The audio could not be uploaded for transcription");
  const { upload_url } = (await response.json()) as { upload_url: string };
  return upload_url;
}

async function post<T>(key: string, path: string, payload: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { authorization: key, "content-type": "application/json" },
    body: JSON.stringify(payload),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw await failure(response, "Transcription could not be started");
  return (await response.json()) as T;
}

async function waitFor(key: string, id: string, signal?: AbortSignal): Promise<Job> {
  for (;;) {
    if (signal?.aborted) throw new Error("The lease was lost while waiting for the transcript");
    const response = await fetch(`${BASE}/transcript/${id}`, { headers: { authorization: key }, ...(signal ? { signal } : {}) });
    if (!response.ok) throw await failure(response, "The transcript could not be read back");
    const job = (await response.json()) as Job;
    if (job.status === "completed") return job;
    if (job.status === "error") throw new NonRetryableError(`Transcription failed: ${job.error ?? "no reason given"}`);
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

/** A refused key or a rejected file will not fix itself, so those stop rather than retry. */
async function failure(response: Response, what: string): Promise<Error> {
  const detail = (await response.text().catch(() => "")).slice(0, 200);
  const message = `${what} (${response.status}${detail ? `: ${detail}` : ""})`;
  return response.status === 401 || response.status === 403 || response.status === 400 ? new NonRetryableError(message) : new Error(message);
}

function seconds(utterances: Utterance[]): number {
  return Math.max(...utterances.map((u) => u.end)) / 1000;
}
