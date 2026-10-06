import { describe, expect, it } from "vitest";
import type { PublishInput } from "@mmos/contracts";
import { registry, runOnce } from "../runner";
import { liveEpisodes, publishHandler } from "../steps/publish";
import { MemoryQueue } from "../testing/memory-queue";
import { assemblyAi } from "../providers/assemblyai";
import { FakePublisher } from "./publisher";
import { compareChannels } from "./check";
import { toStatus, zernio } from "./zernio";

const POST: PublishInput = {
  postId: "6f1d3a0e-8d1c-4c64-9a35-2f5a7a0d9c11",
  platform: "youtube",
  accountId: "acc_yt",
  content: "GG on time.",
  title: "The watch my grandmother gave me",
  media: [{ type: "video", url: "https://media.example.com/master.mp4" }],
  scheduledFor: "2026-10-13T01:00:00.000Z",
  idempotencyKey: "post-6f1d3a0e-8d1c",
};

type Sent = { url: string; method: string; headers: Record<string, string>; body: unknown };
function recorder(reply: (s: Sent) => Response) {
  const sent: Sent[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    const s = { url, method: init.method ?? "GET", headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : null };
    sent.push(s);
    return reply(s);
  }) as unknown as typeof globalThis.fetch;
  return { sent, fetch };
}

describe("Zernio client", () => {
  it("schedules with the post's idempotency key and YouTube's title inside the platform entry", async () => {
    const { sent, fetch } = recorder(() => new Response(JSON.stringify({ post: { _id: "zp_1", status: "scheduled", platforms: [{ platform: "youtube", status: "scheduled" }] } })));
    const status = await zernio({ apiKey: "test", fetch }).schedule(POST);
    expect(status).toEqual({ providerPostId: "zp_1", status: "scheduled", liveUrl: null, error: null });
    expect(sent[0]).toMatchObject({ url: "https://zernio.com/api/v1/posts", method: "POST", headers: { authorization: "Bearer test", "idempotency-key": "post-6f1d3a0e-8d1c" } });
    expect(sent[0]!.body).toMatchObject({
      content: "GG on time.",
      scheduledFor: POST.scheduledFor,
      mediaItems: [{ type: "video", url: POST.media[0]!.url }],
      platforms: [{ platform: "youtube", accountId: "acc_yt", platformSpecificData: { title: POST.title, visibility: "public", madeForKids: false } }],
    });
  });

  it("reads the live link back and lists accounts", async () => {
    expect(toStatus({ post: { _id: "zp_1", platforms: [{ status: "published", platformPostUrl: "https://www.youtube.com/watch?v=abc" }] } })).toMatchObject({ status: "published", liveUrl: "https://www.youtube.com/watch?v=abc" });
    const { fetch } = recorder(() => new Response(JSON.stringify({ accounts: [{ _id: "a1", platform: "threads", username: "humantimewithgg", isActive: true }] })));
    expect(await zernio({ apiKey: "t", fetch }).listAccounts()).toEqual([{ id: "a1", platform: "threads", username: "humantimewithgg", active: true }]);
  });

  it("stops for good on a refused key or a rejected post, retries on a server hiccup", async () => {
    for (const [code, name] of [[401, "NonRetryableError"], [422, "NonRetryableError"], [503, "Error"]] as const) {
      const { fetch } = recorder(() => new Response("{}", { status: code }));
      const err = (await zernio({ apiKey: "t", fetch }).schedule(POST).catch((e: Error) => e)) as Error;
      expect(err.name).toBe(name);
    }
  });
});

describe("publish step", () => {
  const run = async (publisher: FakePublisher | ReturnType<typeof zernio>, allowed: string[]) => {
    const q = new MemoryQueue();
    const id = q.add("publish", POST);
    const outcome = await runOnce(q, registry([publishHandler({ publisher, allowed: new Set(allowed) })]), { workerId: "t" });
    return { outcome, row: q.row(id) };
  };

  it("posts through the fake as a dry run, and a retry never makes a second post", async () => {
    const fake = new FakePublisher();
    const a = await run(fake, []);
    const b = await run(fake, []);
    expect(a.outcome.kind).toBe("succeeded");
    expect(a.row.output).toEqual({ providerPostId: "fake_1", status: "scheduled", liveUrl: null, dryRun: true });
    expect(b.row.output).toEqual(a.row.output);
    expect(fake.posts.size).toBe(1);
  });

  it("refuses to post for real unless this episode has Grace's go-ahead", async () => {
    const { sent, fetch } = recorder(() => new Response(JSON.stringify({ post: { _id: "zp_9", status: "scheduled" } })));
    const blocked = await run(zernio({ apiKey: "t", fetch }), []);
    expect(blocked.outcome).toMatchObject({ kind: "failed", error: expect.stringMatching(/not switched on/) });
    expect(sent).toHaveLength(0);
    const allowed = await run(zernio({ apiKey: "t", fetch }), ["ep"]);
    expect(allowed.outcome.kind).toBe("succeeded");
    expect(liveEpisodes({ PUBLISH_LIVE_EPISODES: " a, b ,," })).toEqual(new Set(["a", "b"]));
    expect(liveEpisodes({})).toEqual(new Set());
  });
});

describe("AssemblyAI client", () => {
  it("submits the signed link with speaker labels and filler words, polls, and maps timings", async () => {
    let polls = 0;
    const { sent, fetch } = recorder((s) => {
      if (s.method === "POST") return new Response(JSON.stringify({ id: "tr_1", status: "queued" }));
      polls += 1;
      return new Response(JSON.stringify(polls < 2 ? { id: "tr_1", status: "processing" } : {
        id: "tr_1", status: "completed", language_code: "en_uk", audio_duration: 12.5,
        words: [{ text: "Um,", start: 100, end: 300, confidence: 0.6, speaker: "A" }, { text: "hello", start: 400, end: 700, confidence: 0.99, speaker: "A" }],
        utterances: [{ speaker: "A", start: 100, end: 700, text: "Um, hello" }],
      }));
    });
    const t = await assemblyAi({ apiKey: "k", fetch, pollMs: 1 }).transcribe({ audioUrl: "https://r2.example/audio.m4a?sig", keyterms: ["Human Time with GG"], signal: new AbortController().signal });
    expect(sent[0]!.body).toMatchObject({ audio_url: "https://r2.example/audio.m4a?sig", speaker_labels: true, disfluencies: true, keyterms_prompt: ["Human Time with GG"] });
    expect(sent[0]!.headers.authorization).toBe("k");
    expect(t).toMatchObject({ providerRef: "tr_1", language: "en_uk", durationS: 12.5, words: [{ text: "Um,", startMs: 100, endMs: 300, speaker: "A" }, { text: "hello" }] });
  });

  it("does not retry audio AssemblyAI cannot read", async () => {
    const { fetch } = recorder((s) => new Response(JSON.stringify(s.method === "POST" ? { id: "x", status: "queued" } : { id: "x", status: "error", error: "File does not appear to contain audio" })));
    const err = (await assemblyAi({ apiKey: "k", fetch, pollMs: 1 }).transcribe({ audioUrl: "u", keyterms: [], signal: new AbortController().signal }).catch((e: Error) => e)) as Error;
    expect(err.name).toBe("NonRetryableError");
    expect(err.message).toMatch(/contain audio/);
  });
});

describe("channel check", () => {
  it("says which channels Zernio can post to, without changing any", () => {
    const lines = compareChannels(
      [
        { platform: "youtube", handle: "@HumanTimewithGG", zernio_account_id: "a1" },
        { platform: "instagram", handle: "@humantimewithgg", zernio_account_id: "gone" },
        { platform: "threads", handle: "@humantimewithgg", zernio_account_id: null },
      ],
      [{ id: "a1", platform: "youtube", username: "HumanTimewithGG", active: true }, { id: "t9", platform: "threads", username: "humantimewithgg", active: true }],
    );
    expect(lines).toEqual([
      "youtube @HumanTimewithGG: connected in Zernio",
      "instagram @humantimewithgg: its Zernio account id is not among the connected accounts (reconnect it in Zernio)",
      "threads @humantimewithgg: no Zernio account id saved; Zernio has threads account t9 (@humantimewithgg)",
    ]);
  });
});
