import type { Transcript } from "@mmos/contracts";

/**
 * What the transcribe step needs from the outside world, and nothing more.
 *
 * Keeping it this small means the step can be built and tested with no account
 * anywhere, and swapping engines later is one file rather than a rewrite
 * (portability seam, decision 0003).
 */
export type Transcriber = {
  /** Names the engine in logs and in the transcript itself. */
  readonly name: string;
  /**
   * `audio` is a local path to the small file ingest made. `language` left out
   * means "work it out". Throw for a refusal that trying again cannot fix.
   */
  transcribe(audio: string, options: { language?: string; signal?: AbortSignal }): Promise<Transcript>;
};
