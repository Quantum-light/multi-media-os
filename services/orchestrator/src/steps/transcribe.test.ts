import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Transcript } from "@mmos/contracts";
import { NonRetryableError } from "../handler";
import type { ClaimedJob } from "../queue";
import type { WorkerStore } from "../storage";
import type { Transcriber } from "../transcribe/port";
import { transcribeHandler } from "./transcribe";

const WORKSPACE = "11111111-1111-4111-8111-111111111111";
const EPISODE = "22222222-2222-4222-8222-222222222222";

const job: ClaimedJob = {
  id: "33333333-3333-4333-8333-333333333333",
  workspaceId: WORKSPACE,
  episodeId: EPISODE,
  step: "transcribe",
  input: {},
  attempt: 1,
};

const spoken = Transcript.parse({
  language: "en",
  durationS: 30,
  provider: "fake",
  segments: [
    { startS: 0, endS: 5, text: "Time is not a line." },
    { startS: 5, endS: 11, text: "It is something you live inside." },
  ],
});

let root = "";
let uploaded: { key: string; body: string; contentType: string }[] = [];

function store(): WorkerStore {
  return {
    async download(_key, dest) {
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, "pretend audio");
      return { sha256: "a".repeat(64), bytes: 13 };
    },
    async upload(key, src, contentType) {
      uploaded.push({ key, body: await readFile(src, "utf8"), contentType });
    },
  };
}

function transcriber(result: Transcript | Error = spoken): Transcriber {
  return {
    name: "fake",
    async transcribe() {
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "transcribe-test-"));
  uploaded = [];
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("the transcribe step", () => {
  it("puts the transcript in storage and keeps only the key and the counts on the job", async () => {
    const handler = transcribeHandler(store(), transcriber(), { workRoot: root });
    const { output } = await handler.run({ audioKey: "ws/x/audio.m4a", durationS: 30 }, { job, signal: new AbortController().signal });

    expect(output).toMatchObject({
      transcriptKey: `ws/${WORKSPACE}/episodes/${EPISODE}/derived/transcript.json`,
      durationS: 30,
      language: "en",
      segmentCount: 2,
      wordCount: 5 + 6,
      provider: "fake",
      model: null,
    });
  });

  it("stores the transcript as readable JSON that parses back to a transcript", async () => {
    const handler = transcribeHandler(store(), transcriber(), { workRoot: root });
    await handler.run({ audioKey: "ws/x/audio.m4a", durationS: 30 }, { job, signal: new AbortController().signal });

    expect(uploaded).toHaveLength(1);
    expect(uploaded[0]?.contentType).toBe("application/json");
    expect(Transcript.safeParse(JSON.parse(uploaded[0]?.body ?? "")).success).toBe(true);
  });

  it("passes a chosen language through, and says nothing when there is none", async () => {
    const asked: { language?: string }[] = [];
    const listening: Transcriber = {
      name: "fake",
      async transcribe(_audio, options) {
        asked.push({ ...(options.language ? { language: options.language } : {}) });
        return spoken;
      },
    };
    const handler = transcribeHandler(store(), listening, { workRoot: root });
    const ctx = { job, signal: new AbortController().signal };
    await handler.run({ audioKey: "k", durationS: 30, language: "en" }, ctx);
    await handler.run({ audioKey: "k", durationS: 30 }, ctx);
    expect(asked).toEqual([{ language: "en" }, {}]);
  });

  it("lets a refusal that cannot be retried travel up untouched", async () => {
    const refusal = new NonRetryableError("ASSEMBLYAI_API_KEY is not set in Railway, so nothing can be transcribed yet.");
    const handler = transcribeHandler(store(), transcriber(refusal), { workRoot: root });
    await expect(handler.run({ audioKey: "k", durationS: 30 }, { job, signal: new AbortController().signal })).rejects.toThrow(NonRetryableError);
    expect(uploaded).toHaveLength(0);
  });

  it("cleans up its working folder whether it worked or failed", async () => {
    const handler = transcribeHandler(store(), transcriber(new Error("boom")), { workRoot: root });
    await expect(handler.run({ audioKey: "k", durationS: 30 }, { job, signal: new AbortController().signal })).rejects.toThrow("boom");
    const { readdir } = await import("node:fs/promises");
    expect(await readdir(root)).toEqual([]);
  });
});
