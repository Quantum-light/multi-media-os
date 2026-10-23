import type { TranscriptDoc } from "@mmos/contracts";
import { NonRetryableError } from "../handler";
import { wait } from "./wait";

export type TranscribeRequest = { audioUrl: string; keyterms: string[]; signal: AbortSignal };

/** Speech to text. AssemblyAI in production; a fake in tests. */
export interface Transcriber {
  transcribe(req: TranscribeRequest): Promise<Omit<TranscriptDoc, "version">>;
}

type Fetch = typeof fetch;
type AaiWord = { text: string; start: number; end: number; confidence: number; speaker?: string | null };
type AaiTranscript = {
  id: string;
  status: "queued" | "processing" | "completed" | "error";
  error?: string;
  language_code?: string;
  audio_duration?: number;
  words?: AaiWord[];
  utterances?: { speaker: string; start: number; end: number; text: string }[];
};

export type AssemblyAiOptions = { apiKey: string; baseUrl?: string; fetch?: Fetch; pollMs?: number; maxWaitMs?: number };

/**
 * AssemblyAI over plain HTTPS. The audio is fetched by AssemblyAI from a short-lived signed
 * link, so no bytes pass through the worker. Speaker labels, word timings, filler words kept
 * (the cut step needs them).
 */
export function assemblyAi(opts: AssemblyAiOptions): Transcriber {
  const base = (opts.baseUrl ?? "https://api.assemblyai.com").replace(/\/$/, "");
  const doFetch = opts.fetch ?? fetch;
  const pollMs = opts.pollMs ?? 3000;
  const maxWaitMs = opts.maxWaitMs ?? 30 * 60_000;
  const headers = { authorization: opts.apiKey, "content-type": "application/json" };

  const call = async <T>(path: string, init: RequestInit, signal: AbortSignal): Promise<T> => {
    const res = await doFetch(`${base}${path}`, { ...init, headers, signal });
    const body = await res.text();
    if (res.status === 401 || res.status === 403) throw new NonRetryableError(`AssemblyAI refused the key (${res.status}). Check ASSEMBLYAI_API_KEY in Railway.`);
    if (res.status === 400) throw new NonRetryableError(`AssemblyAI rejected the request: ${body.slice(0, 300)}`);
    if (!res.ok) throw new Error(`AssemblyAI ${res.status}: ${body.slice(0, 300)}`);
    return JSON.parse(body) as T;
  };

  return {
    async transcribe({ audioUrl, keyterms, signal }) {
      const submitted = await call<AaiTranscript>("/v2/transcript", {
        method: "POST",
        body: JSON.stringify({
          audio_url: audioUrl,
          speech_models: ["universal-3-5-pro", "universal-2"],
          language_detection: true,
          speaker_labels: true,
          disfluencies: true,
          punctuate: true,
          format_text: true,
          ...(keyterms.length ? { keyterms_prompt: keyterms.slice(0, 200) } : {}),
        }),
      }, signal);

      const started = Date.now();
      let t = submitted;
      while (t.status === "queued" || t.status === "processing") {
        if (Date.now() - started > maxWaitMs) throw new Error(`AssemblyAI still working on ${t.id} after ${Math.round(maxWaitMs / 60000)} minutes`);
        await wait(pollMs, signal);
        t = await call<AaiTranscript>(`/v2/transcript/${t.id}`, { method: "GET" }, signal);
      }
      if (t.status === "error") throw new NonRetryableError(`AssemblyAI could not transcribe this audio: ${t.error ?? "no reason given"}`);

      const words = (t.words ?? [])
        .filter((w) => w.text.trim().length > 0)
        .map((w) => ({
          text: w.text,
          startMs: Math.round(w.start),
          endMs: Math.round(w.end),
          confidence: Math.min(1, Math.max(0, w.confidence)),
          speaker: w.speaker ?? null,
        }));
      const durationS = t.audio_duration ?? (words.length ? words[words.length - 1]!.endMs / 1000 : 0);
      if (durationS <= 0 || words.length === 0) throw new NonRetryableError("AssemblyAI heard no speech in this recording");
      return {
        provider: "assemblyai",
        providerRef: t.id,
        language: t.language_code ?? "en",
        durationS,
        words,
        utterances: (t.utterances ?? []).map((u) => ({ speaker: u.speaker, startMs: Math.round(u.start), endMs: Math.round(u.end), text: u.text })),
      };
    },
  };
}
