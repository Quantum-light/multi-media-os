import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registry, runOnce } from "../runner";
import { probe } from "../media/probe";
import { folderStore } from "../storage";
import { MemoryQueue } from "../testing/memory-queue";
import { ingestHandler } from "./ingest";

const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

// CI installs ffmpeg, so there these tests always run; a laptop without it skips them.
describe.skipIf(!hasFfmpeg && !process.env.CI)("ingest", () => {
  let root: string;
  let store: ReturnType<typeof folderStore>;
  const ASSET = "6f1d3a0e-8d1c-4c64-9a35-2f5a7a0d9c11";

  const make = async (key: string, args: string[]) => {
    const out = store.path(key);
    await mkdir(join(out, ".."), { recursive: true });
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args, out]);
    return (await stat(out)).size;
  };

  const runIngest = async (key: string, bytes: number) => {
    const q = new MemoryQueue();
    const id = q.add("ingest", { assetId: ASSET, key, bytes });
    const outcome = await runOnce(q, registry([ingestHandler(store, { workRoot: root })]), { workerId: "t", leaseSeconds: 120 });
    return { outcome, row: q.row(id) };
  };

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "mmos-ingest-"));
    store = folderStore(join(root, "store"));
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("turns a 1080p video into a checksum, mono 16 kHz audio and a 540p preview", async () => {
    const key = "ws/ws/episodes/ep/source/take.mp4";
    const bytes = await make(key, [
      "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30:duration=12",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=12",
      "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest",
    ]);
    const started = Date.now();
    const { outcome, row } = await runIngest(key, bytes);
    const seconds = (Date.now() - started) / 1000;

    expect(outcome.kind).toBe("succeeded");
    const out = row.output as { sha256: string; durationS: number; video: { width: number; height: number; fps: number }; audioKey: string; proxyKey: string };
    expect(out.sha256).toBe(createHash("sha256").update(await readFile(store.path(key))).digest("hex"));
    expect(out.durationS).toBeCloseTo(12, 0);
    expect(out.video).toEqual({ width: 1920, height: 1080, fps: 30 });
    expect(out.audioKey).toBe("ws/ws/episodes/ep/derived/audio.m4a");

    const audio = await probe(store.path(out.audioKey));
    expect(audio.video).toBeNull();
    const audioStream = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels,sample_rate", "-of", "json", store.path(out.audioKey)]).toString()).streams[0];
    expect(audioStream).toMatchObject({ channels: 1, sample_rate: "16000" });

    const proxy = await probe(store.path(out.proxyKey));
    expect(proxy.video?.height).toBe(540);
    expect(proxy.video?.width).toBe(960);
    expect(seconds).toBeLessThan(60);
  }, 120_000);

  it("handles audio-only podcasts: no preview, still audio for transcription", async () => {
    const key = "ws/ws/episodes/ep/source/pod.m4a";
    const bytes = await make(key, ["-f", "lavfi", "-i", "sine=frequency=220:duration=8", "-c:a", "aac"]);
    const { outcome, row } = await runIngest(key, bytes);
    expect(outcome.kind).toBe("succeeded");
    expect(row.output).toMatchObject({ video: null, proxyKey: null, audioKey: "ws/ws/episodes/ep/derived/audio.m4a" });
  }, 60_000);

  it("refuses, without retrying, a video with no sound and a file that is not media", async () => {
    const silent = "ws/ws/episodes/ep/source/silent.mp4";
    const bytes = await make(silent, ["-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=2", "-c:v", "libx264", "-preset", "ultrafast"]);
    const a = await runIngest(silent, bytes);
    expect(a.outcome).toMatchObject({ kind: "failed", error: expect.stringMatching(/no sound/) });

    const junk = "ws/ws/episodes/ep/source/notes.txt";
    await writeFile(store.path(junk), "just some text");
    const b = await runIngest(junk, 14);
    expect(b.outcome).toMatchObject({ kind: "failed", error: expect.stringMatching(/Not a readable audio or video file/) });
  }, 60_000);

  it("retries when the stored file is not the size the upload promised", async () => {
    const key = "ws/ws/episodes/ep/source/pod.m4a";
    const { outcome } = await runIngest(key, 1);
    expect(outcome).toMatchObject({ kind: "retrying", error: expect.stringMatching(/expected 1/) });
  }, 60_000);
});
