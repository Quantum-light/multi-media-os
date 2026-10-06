import type { StepName, Word } from "@mmos/contracts";
import type { EpisodeReader, ShowContext } from "../episode";
import type { TranscribeRequest, Transcriber } from "../providers/assemblyai";
import type { MemoryQueue } from "./memory-queue";

export const HUMAN_TIME: ShowContext = {
  showName: "Human Time with GG",
  kind: "video",
  brandName: "Quantum Light Science",
  compass: { mission: "Help everyday people understand time, and use it to live fuller lives.", pillars: ["Personal growth and time", "Relationships and family"] },
  voiceKit: null,
  voiceLessons: [],
  platforms: ["youtube", "instagram", "threads"],
};

/** Reads step outputs straight from a MemoryQueue, newest success first. */
export class MemoryEpisodeReader implements EpisodeReader {
  constructor(private readonly queue: MemoryQueue, private readonly context: ShowContext = HUMAN_TIME) {}
  async show() {
    return this.context;
  }
  async stepOutput(_episodeId: string, step: StepName) {
    const rows = [...this.queue.rows.values()].filter((r) => r.step === step && r.status === "succeeded");
    return rows[rows.length - 1]?.output ?? null;
  }
}

/** Builds word timings from text: each token 0.3 s long, 0.1 s apart; "||" makes a 3 s pause. */
export function wordsFrom(text: string, speaker = "A"): { words: Word[]; durationS: number } {
  const words: Word[] = [];
  let t = 0.5;
  for (const token of text.split(/\s+/).filter(Boolean)) {
    if (token === "||") {
      t += 3;
      continue;
    }
    words.push({ text: token, startMs: Math.round(t * 1000), endMs: Math.round((t + 0.3) * 1000), confidence: 0.95, speaker });
    t += 0.4;
  }
  return { words, durationS: Math.round((t + 0.5) * 10) / 10 };
}

/** A transcriber that answers from a script and remembers what it was asked. */
export class FakeTranscriber implements Transcriber {
  readonly requests: Omit<TranscribeRequest, "signal">[] = [];
  constructor(private readonly text: string) {}
  async transcribe(req: TranscribeRequest) {
    this.requests.push({ audioUrl: req.audioUrl, keyterms: req.keyterms });
    const { words, durationS } = wordsFrom(this.text);
    return { provider: "assemblyai" as const, providerRef: "fake_1", language: "en", durationS, words, utterances: [{ speaker: "A", startMs: words[0]!.startMs, endMs: words[words.length - 1]!.endMs, text: words.map((w) => w.text).join(" ") }] };
  }
}
