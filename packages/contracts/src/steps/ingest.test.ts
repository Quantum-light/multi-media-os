import { describe, expect, it } from "vitest";
import { IngestInput, IngestOutput, ingest } from "./ingest";

const sha = "a".repeat(64);

describe("ingest contract", () => {
  it("is the ingest step and runs for podcasts too", () => {
    expect(ingest.name).toBe("ingest");
    expect(ingest.videoOnly).toBe(false);
  });
  it("accepts a real input and rejects bad ones", () => {
    const ok = { assetId: "6f1d3a0e-8d1c-4c64-9a35-2f5a7a0d9c11", key: "ws/a/episodes/b/source/raw.mp4", bytes: 2_300_000_000 };
    expect(IngestInput.safeParse(ok).success).toBe(true);
    expect(IngestInput.safeParse({ ...ok, assetId: "nope" }).success).toBe(false);
    expect(IngestInput.safeParse({ ...ok, bytes: 0 }).success).toBe(false);
    expect(IngestInput.safeParse({ ...ok, key: "" }).success).toBe(false);
  });
  it("allows audio-only output and rejects a bad checksum", () => {
    const audio = { sha256: sha, durationS: 3600, video: null, audioKey: "x/audio.m4a", proxyKey: null };
    expect(IngestOutput.safeParse(audio).success).toBe(true);
    expect(IngestOutput.safeParse({ ...audio, sha256: "ABC" }).success).toBe(false);
    expect(IngestOutput.safeParse({ ...audio, video: { width: 1920, height: 1080, fps: 0 } }).success).toBe(false);
  });
});
