import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FakeLlm } from "@mmos/agents";
import type { StepName } from "@mmos/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { slateRows, type ClipRow, type ClipSlateWriter, type SlateRef } from "../clips/store";
import type { Handler } from "../handler";
import { registry, runOnce } from "../runner";
import { folderStore } from "../storage";
import { FakeTranscriber, MemoryEpisodeReader } from "../testing/fakes";
import { MemoryQueue } from "../testing/memory-queue";
import { understandHandler, writeHandler } from "./agents";
import { cutHandler } from "./cut";
import { clipHandler, storyboardHandler } from "./shorts";
import { transcribeHandler } from "./transcribe";

const SPEECH = [
  "Welcome to Human Time. Um today I want to talk about time and the people we share it with.",
  "||",
  "When I was nine my grandmother gave me a watch and she said time is the one thing you give away and never get back.",
  "The thing about time is that we never really the thing about time is that we only ever have it together.",
  "So here is a practice for this week. Spend one hour with someone and put the phone in another room.",
  "And that is all for today. Thank you for spending this time with me and see you next week.",
].join(" ");

const UNDERSTANDING = {
  summary: "GG on time as something we share.",
  chapters: [{ startS: 0, title: "Welcome" }, { startS: 14, title: "The watch" }, { startS: 30, title: "One hour" }],
  moments: [{ startS: 9.5, endS: 26, kind: "story", quote: "When I was nine my grandmother gave me a watch", why: "A personal story" }],
  themes: [{ name: "Shared time", slug: "shared-time" }],
  pillars: [{ pillar: "Relationships and family", score: 0.8, evidence: "the grandmother story" }],
};
const DRAFT = {
  titleOptions: ["The watch my grandmother gave me", "Time we share"],
  description: "GG on why time is only ever ours together.",
  captions: [{ platform: "youtube", body: "Why time is shared." }, { platform: "instagram", body: "One hour, phone away." }, { platform: "threads", body: "Time is the one thing you give away." }],
};

/**
 * The fake model answers the clip tool out of the transcript it was shown, so its
 * candidate is really in the recording and survives grounding. It takes the longest
 * line and its first forty words: the fake transcriber spaces words 0.4s apart, so
 * that is about sixteen seconds, inside the 15-to-90 a clip has to run.
 */
function offerClips(prompt: string): unknown {
  const lines = prompt.split("\n").filter((l) => /^\[\d+s /.test(l));
  const line = lines.sort((a, b) => b.length - a.length)[0];
  if (!line) return { candidates: [] };
  const startS = Number(/^\[(\d+)s/.exec(line)![1]);
  const spoken = line.slice(line.indexOf(": ") + 2).split(" ").slice(0, 40);
  return {
    candidates: [
      {
        startS,
        endS: startS + spoken.length * 0.4,
        signal: "standalone_idea",
        score: 82,
        hook: spoken.slice(0, 6).join(" "),
        quote: spoken.join(" "),
        reason: "It stands on its own.",
      },
    ],
  };
}

/** The slate the clip step writes, kept in memory so the chain can be checked without a database. */
class MemoryClipWriter implements ClipSlateWriter {
  readonly rows: ClipRow[] = [];
  async save(ref: SlateRef, plan: Parameters<ClipSlateWriter["save"]>[1]): Promise<number> {
    const rows = slateRows(ref, plan);
    this.rows.push(...rows);
    return rows.length;
  }
}

describe("the agent steps, end to end on fakes", () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "mmos-pipeline-"));
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("goes from ingest output to a storyboard, each step feeding the next", async () => {
    const store = folderStore(root);
    const q = new MemoryQueue();
    const reader = new MemoryEpisodeReader(q);
    const transcriber = new FakeTranscriber(SPEECH);
    const llm = new FakeLlm({ map_episode: UNDERSTANDING, save_drafts: DRAFT, offer_clips: offerClips });
    const clips = new MemoryClipWriter();
    const handlers: Handler[] = [
      transcribeHandler({ store, reader, transcriber }),
      cutHandler({ store }),
      understandHandler({ store, reader, llm }),
      writeHandler({ reader, llm }),
      clipHandler({ reader, store, llm, clips }),
      storyboardHandler({ reader }),
    ];
    const map = registry(handlers);
    const order: StepName[] = ["transcribe", "cut", "understand", "write", "clip", "storyboard"];

    // What the SQL chain does: each success enqueues the next step with its output.
    let input: unknown = { sha256: "a".repeat(64), durationS: 60, video: { width: 1920, height: 1080, fps: 30 }, audioKey: "ws/ws/episodes/ep/derived/audio.m4a", proxyKey: "ws/ws/episodes/ep/derived/proxy-540p.mp4" };
    for (const step of order) {
      const id = q.add(step, input);
      const outcome = await runOnce(q, map, { workerId: "t" });
      expect(outcome, `${step}: ${JSON.stringify(q.row(id).error)}`).toMatchObject({ kind: "succeeded", step });
      input = q.row(id).output;
    }

    expect(transcriber.requests[0]).toMatchObject({ audioUrl: expect.stringContaining("derived/audio.m4a"), keyterms: expect.arrayContaining(["Human Time with GG"]) });
    const out = (s: StepName) => [...q.rows.values()].find((r) => r.step === s)!.output as Record<string, unknown>;
    const cut = out("cut") as { cuts: { reason: string }[]; removedS: number };
    expect(cut.cuts.map((c) => c.reason)).toEqual(expect.arrayContaining(["filler", "silence", "retake"]));
    expect(llm.calls.find((c) => c.tool === "map_episode")!.prompt).not.toContain("we never really the thing");

    const written = out("write") as { title: string; chaptersText: string; captions: unknown[] };
    expect(written.title).toBe("The watch my grandmother gave me");
    expect(written.chaptersText.split("\n")[0]).toBe("0:00 Welcome");
    expect(written.captions).toHaveLength(3);
    // The clip step's own result is the shape of the slate; the slate itself went to the writer.
    expect(out("clip")).toMatchObject({ target: 21, proposed: 1, chosen: 1, reserve: 0, shortfall: 20 });
    expect(clips.rows.map((r) => [r.rank, r.state, r.signal])).toEqual([[1, "chosen", "standalone_idea"]]);
    expect((out("storyboard") as { cues: { block: string }[] }).cues.map((c) => c.block)).toContain("chapter_card");
    expect([...q.rows.values()].find((r) => r.step === "understand")!.costPence).toBeGreaterThan(0);
  });

  it("says plainly what is missing when an earlier step's result is absent", async () => {
    const q = new MemoryQueue();
    const llm = new FakeLlm({ save_drafts: DRAFT });
    q.add("write", { ...UNDERSTANDING, transcriptKey: "k", durationS: 60, model: "m" });
    const outcome = await runOnce(q, registry([writeHandler({ reader: new MemoryEpisodeReader(q), llm })]), { workerId: "t" });
    expect(outcome).toMatchObject({ kind: "retrying", error: expect.stringMatching(/cut result/) });
  });
});
