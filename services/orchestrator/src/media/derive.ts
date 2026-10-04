import { run } from "./run";

/**
 * Mono 16 kHz AAC: what transcription needs, at a few MB per hour instead of gigabytes.
 * Audio only, so it takes seconds even for a long recording.
 */
export function extractAudio(source: string, out: string, signal?: AbortSignal): Promise<string> {
  return run("ffmpeg", ["-hide_banner", "-y", "-i", source, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "aac", "-b:a", "48k", out], signal);
}

/**
 * A 540p preview for cut decisions and Review: fast preset, light quality, web-ready.
 * The full-quality source is only encoded once, at the very end, for the final master.
 */
export function makeProxy(source: string, out: string, hasAudio: boolean, signal?: AbortSignal): Promise<string> {
  return run(
    "ffmpeg",
    [
      "-hide_banner", "-y", "-i", source,
      "-vf", "scale=-2:'min(540,ih)'",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-pix_fmt", "yuv420p",
      ...(hasAudio ? ["-c:a", "aac", "-b:a", "64k", "-ac", "2"] : ["-an"]),
      "-movflags", "+faststart",
      out,
    ],
    signal,
  );
}
