import { NonRetryableError } from "../handler";
import { run } from "./run";

export type Probe = {
  durationS: number;
  video: { width: number; height: number; fps: number } | null;
  hasAudio: boolean;
};

type Stream = { codec_type?: string; width?: number; height?: number; avg_frame_rate?: string; r_frame_rate?: string; disposition?: { attached_pic?: number } };

/** Reads duration, frame size, frame rate and whether there is sound. A file with neither is refused. */
export async function probe(path: string, signal?: AbortSignal): Promise<Probe> {
  const out = await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path], signal).catch((e: Error) => {
    throw new NonRetryableError(`Not a readable audio or video file (${e.message})`);
  });
  const json = JSON.parse(out) as { format?: { duration?: string }; streams?: Stream[] };
  const streams = json.streams ?? [];
  const v = streams.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic);
  const hasAudio = streams.some((s) => s.codec_type === "audio");
  const durationS = Number(json.format?.duration);
  if ((!v && !hasAudio) || !Number.isFinite(durationS) || durationS <= 0) throw new NonRetryableError("The file has no audio or video to work with");
  return {
    durationS,
    hasAudio,
    video: v && v.width && v.height ? { width: v.width, height: v.height, fps: frameRate(v.avg_frame_rate) ?? frameRate(v.r_frame_rate) ?? 30 } : null,
  };
}

export function frameRate(value: string | undefined): number | null {
  if (!value) return null;
  const [n, d] = value.split("/").map(Number);
  if (!n || !Number.isFinite(n)) return null;
  const fps = d ? n / d : n;
  return Number.isFinite(fps) && fps > 0 ? Math.round(fps * 1000) / 1000 : null;
}
