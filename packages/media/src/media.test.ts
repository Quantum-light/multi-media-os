import { describe, expect, it } from "vitest";
import { MULTIPART, keyInWorkspace, partRange, planParts, quickFingerprint, safeFileName, sourceKey } from "./index";

const MiB = 1024 * 1024;

describe("planParts", () => {
  it("uses 16 MiB parts for ordinary recordings", () => {
    expect(planParts(2.3e9)).toEqual({ partSize: 16 * MiB, partCount: Math.ceil(2.3e9 / (16 * MiB)) });
    expect(planParts(1)).toEqual({ partSize: 16 * MiB, partCount: 1 });
  });
  it("grows parts so a huge file never needs more than 10,000", () => {
    const size = 500 * 1024 * MiB; // 500 GiB
    const plan = planParts(size);
    expect(plan.partCount).toBeLessThanOrEqual(MULTIPART.maxParts);
    expect(plan.partSize % MiB).toBe(0);
  });
  it("refuses empty and impossible files", () => {
    expect(() => planParts(0)).toThrow(/empty/);
    expect(() => planParts(6 * 1024 ** 4)).toThrow(/larger/);
  });
  it("gives each part its exact byte range", () => {
    const size = 40 * MiB + 3;
    const plan = planParts(size);
    expect(partRange(1, plan, size)).toEqual({ start: 0, end: 16 * MiB });
    expect(partRange(3, plan, size)).toEqual({ start: 32 * MiB, end: size });
    expect(() => partRange(4, plan, size)).toThrow();
  });
});

describe("keys", () => {
  it("makes safe names and workspace-scoped keys", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("Épisode 2 (final).MP4")).toBe("Episode-2-final.MP4");
    expect(safeFileName("///")).toBe("recording");
    expect(sourceKey("w1", "e1", "raw take.mov")).toBe("ws/w1/episodes/e1/source/raw-take.mov");
  });
  it("only accepts keys inside the workspace", () => {
    expect(keyInWorkspace("ws/w1/episodes/e1/source/a.mp4", "w1")).toBe(true);
    expect(keyInWorkspace("ws/w2/episodes/e1/source/a.mp4", "w1")).toBe(false);
    expect(keyInWorkspace("ws/w1/../w2/x", "w1")).toBe(false);
  });
});

describe("quickFingerprint", () => {
  it("is stable, size-aware and reads only the edges", async () => {
    const big = new Uint8Array(20 * MiB);
    big[10 * MiB] = 7; // a change in the middle is not read
    const a = await quickFingerprint(new Blob([big]));
    const b = await quickFingerprint(new Blob([new Uint8Array(20 * MiB)]));
    expect(a).toMatch(/^qf1:[0-9a-f]{64}$/);
    expect(a).toBe(b);
    const tailChanged = new Uint8Array(20 * MiB);
    tailChanged[20 * MiB - 1] = 1;
    expect(await quickFingerprint(new Blob([tailChanged]))).not.toBe(a);
    expect(await quickFingerprint(new Blob([new Uint8Array(20 * MiB + 1)]))).not.toBe(a);
  });
});
