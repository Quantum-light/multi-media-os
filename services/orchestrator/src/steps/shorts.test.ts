import { FakeLlm } from "@mmos/agents";
import { ClipOutput, type ClipPlan, type ScoredClip, type StepName, type TranscriptDoc } from "@mmos/contracts";
import { describe, expect, it } from "vitest";
import { slateRows, type ClipRow, type ClipSlateWriter, type SlateRef } from "../clips/store";
import type { EpisodeReader, ShowContext } from "../episode";
import type { ClaimedJob } from "../queue";
import type { WorkerStore } from "../storage";
import { HUMAN_TIME, wordsFrom } from "../testing/fakes";
import { clipHandler, clipTarget } from "./shorts";

const LINES = [
  "Welcome to Human Time. Today I want to talk about the hours we give away and the hours we keep for ourselves.",
  "When I was nine my grandmother gave me a watch and she told me that time is the one thing you never get back.",
  "Most people think they are short of time, and the truth is that they are short of attention, which is a different problem.",
  "Here is a practice for this week. Spend one hour with someone you love and leave the phone in another room.",
  "I used to believe a full calendar meant a full life, and that belief cost me three years I would like to have back.",
  "The thing nobody says out loud is that rest is work. It is the work that makes the rest of the work possible.",
  "A week has one hundred and sixty eight hours, and naming where forty of them go is the most honest thing you can do.",
  "And that is all for today. Thank you for spending this time with me, and I will see you again next week.",
];

const TRANSCRIPT_KEY = "ws/ws/episodes/ep/derived/transcript.json";
const { words, durationS } = wordsFrom(LINES.join(" "));

const doc: TranscriptDoc = {
  version: 1,
  provider: "assemblyai",
  providerRef: "fake_1",
  language: "en",
  durationS,
  words,
  utterances: [{ speaker: "A", startMs: words[0]!.startMs, endMs: words[words.length - 1]!.endMs, text: LINES.join(" ") }],
};

/** Where each line's words start, so a candidate can be written as "lines 2 and 3". */
const lineStarts = LINES.reduce<number[]>((acc, line, i) => {
  const before = i === 0 ? 0 : acc[i - 1]! + LINES[i - 1]!.split(/\s+/).filter(Boolean).length;
  return [...acc, before];
}, []);

/** A candidate over two of the lines above, quoted from the transcript so it survives grounding. */
function candidate(line: number, over: Partial<ScoredClip> = {}, lines = 2): ScoredClip {
  const from = lineStarts[line]!;
  const to = Math.min(from + LINES.slice(line, line + lines).join(" ").split(/\s+/).filter(Boolean).length, words.length);
  const slice = words.slice(from, to);
  return {
    startS: slice[0]!.startMs / 1000,
    endS: slice[slice.length - 1]!.endMs / 1000,
    signal: "standalone_idea",
    score: 80,
    hook: slice.slice(0, 6).map((w) => w.text).join(" "),
    quote: slice.map((w) => w.text).join(" "),
    reason: "It stands on its own.",
    ...over,
  };
}

class TestReader implements EpisodeReader {
  constructor(private readonly context: ShowContext = HUMAN_TIME) {}
  async show() {
    return this.context;
  }
  async stepOutput(_episodeId: string, step: StepName) {
    if (step === "understand") {
      return {
        summary: "GG on the hours we give away.",
        chapters: [{ startS: 0, title: "Welcome" }],
        moments: [],
        themes: [{ name: "Shared time", slug: "shared-time" }],
        pillars: [],
        transcriptKey: TRANSCRIPT_KEY,
        durationS,
        model: "fake-model",
      };
    }
    if (step === "cut") return { transcriptKey: TRANSCRIPT_KEY, durationS, cuts: [], removedS: 0, keptS: durationS };
    return null;
  }
}

/** Only the transcript is ever read, so the rest of the store says so rather than pretending. */
const store: WorkerStore = {
  async readText(key: string) {
    if (key !== TRANSCRIPT_KEY) throw new Error(`asked for ${key}`);
    return JSON.stringify(doc);
  },
  async download() {
    throw new Error("the clip step downloads nothing");
  },
  async upload() {
    throw new Error("the clip step uploads nothing");
  },
  async writeText() {
    throw new Error("the clip step writes no files");
  },
  async signedGetUrl() {
    throw new Error("the clip step shares no links");
  },
};

class MemoryClipWriter implements ClipSlateWriter {
  readonly rows: ClipRow[] = [];
  async save(ref: SlateRef, plan: ClipPlan): Promise<number> {
    const rows = slateRows(ref, plan);
    this.rows.push(...rows);
    return rows.length;
  }
}

const JOB: ClaimedJob = { id: "job-1", workspaceId: "ws-1", episodeId: "ep-1", step: "clip", input: {}, attempt: 1 };

async function findClips(candidates: ScoredClip[], show: ShowContext = HUMAN_TIME) {
  const llm = new FakeLlm({ offer_clips: { candidates } });
  const clips = new MemoryClipWriter();
  const handler = clipHandler({ reader: new TestReader(show), store, llm, clips });
  const result = await handler.run({}, { job: JOB, signal: new AbortController().signal });
  return { output: ClipOutput.parse(result.output), rows: clips.rows, llm };
}

const PODCAST: ShowContext = { ...HUMAN_TIME, showName: "Journeys with Time", kind: "podcast" };

describe("the clip step", () => {
  it("asks for half again as many candidates as the show wants", async () => {
    const { llm, output } = await findClips([candidate(0)]);
    expect(output.target).toBe(21);
    expect(llm.calls[0]?.tool).toBe("offer_clips");
    expect(llm.calls[0]?.prompt).toContain("Offer up to 32 candidates");
  });

  it("writes one clip when the model offers two cuts of the same moment", async () => {
    const { output, rows } = await findClips([candidate(0), candidate(0, { score: 95, signal: "opening_line" }, 3)]);
    expect(output.proposed).toBe(2);
    expect(output.chosen).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.score).toBe(95);
  });

  it("reports the shortfall rather than padding the slate", async () => {
    const { output, rows } = await findClips([candidate(0), candidate(2), candidate(4)]);
    expect(output.chosen).toBe(3);
    expect(output.shortfall).toBe(18);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.state === "chosen")).toBe(true);
  });

  it("says so plainly when nothing cleared the bar, and writes nothing", async () => {
    const { output, rows } = await findClips([candidate(0, { score: 20 }), candidate(2, { score: 10 })]);
    expect(output.chosen).toBe(0);
    expect(output.shortfall).toBe(21);
    expect(rows).toHaveLength(0);
  });

  it("drops a candidate whose quote was never said", async () => {
    const invented = candidate(2, { quote: "Buy my course today and unlock your hidden potential forever" });
    const { output, rows } = await findClips([candidate(0), invented]);
    expect(output.proposed).toBe(1);
    expect(rows).toHaveLength(1);
  });

  it("gives every row a signal, a hook and a reason, ranked from one across the whole slate", async () => {
    const show: ShowContext & { settings: Record<string, unknown> } = { ...HUMAN_TIME, settings: { clipsPerEpisode: 2 } };
    const { output, rows } = await findClips(
      [candidate(0, { score: 90 }), candidate(2, { score: 85, signal: "surprising" }), candidate(4, { score: 70, signal: "personal" }), candidate(6, { score: 60 })],
      show,
    );
    expect(output.target).toBe(2);
    expect(output.chosen).toBe(2);
    expect(output.reserve).toBe(2);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(rows.map((r) => r.state)).toEqual(["chosen", "chosen", "reserve", "reserve"]);
    expect(rows.every((r) => r.signal && r.hook && r.reason)).toBe(true);
    expect(rows.every((r) => r.workspace_id === "ws-1" && r.episode_id === "ep-1" && r.job_id === "job-1")).toBe(true);
  });

  it("wants fewer shorts from a podcast", async () => {
    const { output, llm } = await findClips([candidate(0)], PODCAST);
    expect(output.target).toBe(12);
    expect(llm.calls[0]?.prompt).toContain("Offer up to 18 candidates");
    expect(output.shortfall).toBe(11);
  });
});

describe("clipTarget", () => {
  it("takes the number from the show when the show says", () => {
    expect(clipTarget({ ...HUMAN_TIME, settings: { clipsPerEpisode: 9 } } as ShowContext)).toBe(9);
  });

  it("falls back to the kind of show", () => {
    expect(clipTarget(HUMAN_TIME)).toBe(21);
    expect(clipTarget(PODCAST)).toBe(12);
    expect(clipTarget({ ...HUMAN_TIME, kind: "both" })).toBe(21);
  });
});
