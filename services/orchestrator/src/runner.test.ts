import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineStep } from "@mmos/contracts";
import { NonRetryableError, defineHandler } from "./handler";
import { registry, runOnce, runWorker } from "./runner";
import { MemoryQueue } from "./testing/memory-queue";

const transcribe = defineStep({
  name: "transcribe",
  input: z.object({ audioKey: z.string().min(1) }),
  output: z.object({ words: z.number().int().min(0) }),
});

const opts = { workerId: "test", leaseSeconds: 60, maxAttempts: 3 };

function handlerThat(run: (input: { audioKey: string }) => Promise<{ output: { words: number }; costPence?: number }>) {
  return registry([defineHandler({ step: transcribe, run })]);
}

describe("runOnce", () => {
  it("is idle when nothing is waiting", async () => {
    const q = new MemoryQueue();
    expect(await runOnce(q, handlerThat(async () => ({ output: { words: 1 } })), opts)).toEqual({ kind: "idle" });
  });

  it("only claims steps it has a handler for", async () => {
    const q = new MemoryQueue();
    q.add("render", {});
    expect((await runOnce(q, handlerThat(async () => ({ output: { words: 1 } })), opts)).kind).toBe("idle");
    expect(q.row("job-1").status).toBe("queued");
  });

  it("runs the step and saves a valid output with its cost", async () => {
    const q = new MemoryQueue();
    const id = q.add("transcribe", { audioKey: "r2://a.wav" });
    const outcome = await runOnce(q, handlerThat(async (input) => ({ output: { words: input.audioKey.length }, costPence: 7 })), opts);
    expect(outcome).toEqual({ kind: "succeeded", jobId: id, step: "transcribe" });
    expect(q.row(id)).toMatchObject({ status: "succeeded", output: { words: 10 }, costPence: 7 });
  });

  it("fails at once, without retrying, when the input breaks the contract", async () => {
    const q = new MemoryQueue();
    const id = q.add("transcribe", { audioKey: "" });
    let ran = false;
    const outcome = await runOnce(q, handlerThat(async () => { ran = true; return { output: { words: 1 } }; }), opts);
    expect(ran).toBe(false);
    expect(outcome.kind).toBe("failed");
    expect(q.row(id).error).toMatch(/Input does not match the transcribe contract: audioKey/);
  });

  it("fails at once when the output breaks the contract", async () => {
    const q = new MemoryQueue();
    const id = q.add("transcribe", { audioKey: "a" });
    const outcome = await runOnce(q, handlerThat(async () => ({ output: { words: -1 } })), opts);
    expect(outcome.kind).toBe("failed");
    expect(q.row(id).error).toMatch(/Output does not match/);
  });

  it("retries ordinary errors with backoff, then gives up after the last attempt", async () => {
    const q = new MemoryQueue();
    const id = q.add("transcribe", { audioKey: "a" });
    const flaky = handlerThat(async () => { throw new Error("provider timed out"); });

    expect((await runOnce(q, flaky, opts)).kind).toBe("retrying");
    expect(q.row(id).runAfter).toBe(30_000);
    expect((await runOnce(q, flaky, opts)).kind).toBe("idle"); // still backing off

    q.now = 30_000;
    expect((await runOnce(q, flaky, opts)).kind).toBe("retrying");
    expect(q.row(id).runAfter).toBe(30_000 + 60_000);

    q.now = 90_000;
    const last = await runOnce(q, flaky, opts);
    expect(last).toMatchObject({ kind: "failed", error: "provider timed out" });
    expect(q.row(id).attempts).toBe(3);
  });

  it("does not retry a NonRetryableError", async () => {
    const q = new MemoryQueue();
    q.add("transcribe", { audioKey: "a" });
    const outcome = await runOnce(q, handlerThat(async () => { throw new NonRetryableError("file is not audio"); }), opts);
    expect(outcome).toMatchObject({ kind: "failed", error: "file is not audio" });
  });

  it("discards the result when another worker took the lease", async () => {
    const q = new MemoryQueue();
    const id = q.add("transcribe", { audioKey: "a" });
    const outcome = await runOnce(q, handlerThat(async () => {
      // While this worker is busy its lease runs out and another worker reclaims the job.
      q.now = 61_000;
      await q.claim("other", ["transcribe"], 60, 3);
      return { output: { words: 99 } };
    }), opts);
    expect(outcome.kind).toBe("lost");
    expect(q.row(id)).toMatchObject({ status: "running", attempts: 2, output: null });
  });

  it("keeps the lease alive while a long step runs", async () => {
    const q = new MemoryQueue();
    q.add("transcribe", { audioKey: "a" });
    const outcome = await runOnce(q, handlerThat(async () => {
      await new Promise((r) => setTimeout(r, 120));
      return { output: { words: 1 } };
    }), { ...opts, leaseSeconds: 0.09 }); // beats every 30ms
    expect(outcome.kind).toBe("succeeded");
    expect(q.heartbeats).toBeGreaterThanOrEqual(2);
  });

  it("refuses two handlers for one step", () => {
    const h = defineHandler({ step: transcribe, run: async () => ({ output: { words: 0 } }) });
    expect(() => registry([h, h])).toThrow(/Two handlers/);
  });
});

describe("runWorker", () => {
  it("drains the queue and stops cleanly when asked", async () => {
    const q = new MemoryQueue();
    q.add("transcribe", { audioKey: "a" });
    q.add("transcribe", { audioKey: "bb" });
    const stop = new AbortController();
    const seen: string[] = [];
    const handler = defineHandler({ step: transcribe, run: async (input) => ({ output: { words: input.audioKey.length } }) });
    await runWorker(q, [handler], {
      ...opts,
      idleMs: 5,
      signal: stop.signal,
      onOutcome: (o) => {
        seen.push(o.kind);
        if (o.kind === "idle") stop.abort();
      },
    });
    expect(seen).toEqual(["succeeded", "succeeded", "idle"]);
  });

  it("backs off and carries on when the database is unreachable", async () => {
    const q = new MemoryQueue();
    let calls = 0;
    q.claim = async () => {
      calls += 1;
      throw new Error("connection refused");
    };
    const stop = new AbortController();
    const errors: unknown[] = [];
    const handler = defineHandler({ step: transcribe, run: async () => ({ output: { words: 0 } }) });
    await runWorker(q, [handler], { ...opts, idleMs: 1, signal: stop.signal, onError: (e) => { errors.push(e); if (errors.length === 3) stop.abort(); } });
    expect(calls).toBe(3);
    expect(errors).toHaveLength(3);
  });
});
