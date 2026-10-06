import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { TranscriptDoc } from "@mmos/contracts";
import { anthropic, costPence, LlmRefused } from "./anthropic";
import { FakeLlm } from "./testing";
import { transcriptLines } from "./transcript-view";
import { groundUnderstanding, runUnderstand } from "./understand";
import { voiceBrief } from "./voice";
import { editedChapters, runWrite } from "./write";
import { reviewChat } from "./review-chat";

/** Words spaced 0.4 s apart, speaker A, from a sentence list. */
function doc(text: string, startS = 0): Pick<TranscriptDoc, "words" | "durationS"> {
  const ws = text.split(" ").map((t, i) => ({ text: t, startMs: Math.round((startS + i * 0.4) * 1000), endMs: Math.round((startS + i * 0.4 + 0.3) * 1000), confidence: 0.95, speaker: "A" }));
  return { words: ws, durationS: startS + ws.length * 0.4 + 1 };
}

describe("anthropic client", () => {
  it("forces the tool, sends the key in its header, and checks the answer", async () => {
    let sent: { url: string; headers: Record<string, string>; body: Record<string, unknown> } | null = null;
    const fetch = (async (url: string, init: RequestInit) => {
      sent = { url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
      return new Response(JSON.stringify({ content: [{ type: "tool_use", id: "t1", name: "save", input: { n: 3 } }], stop_reason: "tool_use", usage: { input_tokens: 500, output_tokens: 50 } }));
    }) as unknown as typeof globalThis.fetch;
    const llm = anthropic({ apiKey: "test-key", model: "m", fetch });
    const out = await llm.structured({ system: "s", prompt: "p", tool: { name: "save", description: "d", schema: z.object({ n: z.number().max(5) }) } });
    expect(out.data).toEqual({ n: 3 });
    expect(sent!.url).toBe("https://api.anthropic.com/v1/messages");
    expect(sent!.headers["x-api-key"]).toBe("test-key");
    expect(sent!.body).toMatchObject({ model: "m", tool_choice: { type: "tool", name: "save" } });
    expect((sent!.body.tools as { input_schema: { properties: object } }[])[0]!.input_schema.properties).toHaveProperty("n");
  });
  it("refuses for good on a bad key and retries on an answer that fails its checks", async () => {
    const refused = anthropic({ apiKey: "k", fetch: (async () => new Response("no", { status: 401 })) as unknown as typeof fetch });
    await expect(refused.structured({ system: "", prompt: "", tool: { name: "x", description: "", schema: z.object({}) } })).rejects.toBeInstanceOf(LlmRefused);
    const wrong = anthropic({ apiKey: "k", fetch: (async () => new Response(JSON.stringify({ content: [{ type: "tool_use", id: "1", name: "x", input: { n: 9 } }], stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 } }))) as unknown as typeof fetch });
    const err = await wrong.structured({ system: "", prompt: "", tool: { name: "x", description: "", schema: z.object({ n: z.number().max(5) }) } }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(LlmRefused);
  });
  it("prices a call in pence", () => {
    expect(costPence({ inputTokens: 20_000, outputTokens: 3_000 })).toBe(6);
  });
});

describe("what the model reads", () => {
  it("drops cut words and marks each line with its source time", () => {
    const d = doc("Hello and welcome. Um so today we talk about time.");
    const lines = transcriptLines(d, [{ startS: 1.2, endS: 1.5 }]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^\[0s 0:00\] A: Hello and welcome\. so today/);
    expect(lines[0]).not.toContain("Um");
  });
  it("turns corrections into lessons and falls back to a plain voice", () => {
    expect(voiceBrief(null, [])).toMatch(/British English/);
    const brief = voiceBrief({ version: 1, rules: "Warm, curious.", avoidTerms: ["hack"], glossary: [] }, [{ pieceKind: "title", platform: null, before: "10 TIME HACKS", after: "What time really is" }]);
    expect(brief).toContain("Warm, curious.");
    expect(brief).toContain("Never use: hack.");
    expect(brief).toContain('"10 TIME HACKS" became "What time really is"');
  });
});

describe("understand", () => {
  const d = doc("When I was nine my grandmother gave me a watch and said time is the only thing you give away and never get back so I started counting hours differently from that day on", 10);
  const raw = {
    summary: "GG on time as a gift.",
    chapters: [{ startS: 10, title: "The watch" }, { startS: 12, title: "Too close" }, { startS: 500, title: "Past the end" }],
    moments: [
      { startS: 10, endS: 25, kind: "story" as const, quote: "When I was nine my grandmother gave me a watch", why: "Opens the theme" },
      { startS: 10, endS: 25, kind: "claim" as const, quote: "Quantum clocks prove time is fake", why: "Invented" },
    ],
    themes: [{ name: "Time as a gift", slug: "time-as-a-gift" }, { name: "Dup", slug: "time-as-a-gift" }],
    pillars: [{ pillar: "Relationships and family", score: 0.7, evidence: "grandmother" }, { pillar: "Made up", score: 0.9, evidence: "x" }],
  };
  it("keeps only what was said, the known pillars and chapters inside the recording", () => {
    const g = groundUnderstanding(raw, d, ["Relationships and family"]);
    expect(g.moments.map((m) => m.kind)).toEqual(["story"]);
    expect(g.dropped).toBe(1);
    expect(g.chapters.map((c) => c.title)).toEqual(["The watch"]);
    expect(g.pillars.map((p) => p.pillar)).toEqual(["Relationships and family"]);
    expect(g.themes).toHaveLength(1);
  });
  it("asks with the transcript and the Vision, and prices the call", async () => {
    const llm = new FakeLlm({ map_episode: raw });
    const out = await runUnderstand(llm, { showName: "Human Time with GG", brandName: "QLS", compass: { mission: "Help people understand time", pillars: ["Relationships and family"] } }, d, []);
    expect(llm.calls[0]!.prompt).toContain("Mission: Help people understand time");
    expect(llm.calls[0]!.prompt).toContain("[10s 0:10] A: When I was nine");
    expect(llm.calls[0]!.system).toMatch(/Never invent/);
    expect(out.understanding.moments).toHaveLength(1);
    expect(out.costPence).toBeGreaterThan(0);
  });
});

describe("write", () => {
  const u = { summary: "s", chapters: [{ startS: 0, title: "Welcome" }, { startS: 70, title: "The watch" }, { startS: 200, title: "Counting hours" }], moments: [], themes: [{ name: "t", slug: "t" }], pillars: [] };
  it("moves chapters onto the edited timeline", () => {
    const { chapters, chaptersText } = editedChapters(u, [{ startS: 30, endS: 50, reason: "retake", text: "x" }], 300);
    expect(chapters.map((c) => c.atS)).toEqual([0, 50, 180]);
    expect(chaptersText).toBe("0:00 Welcome\n0:50 The watch\n3:00 Counting hours");
  });
  it("keeps one caption per connected platform", async () => {
    const llm = new FakeLlm({ save_drafts: { titleOptions: ["What time really is", "Two"], description: "About time.", captions: [{ platform: "threads", body: "a" }, { platform: "threads", body: "b" }, { platform: "x", body: "c" }, { platform: "instagram", body: "d" }] } });
    const { output } = await runWrite(llm, { showName: "S", brandName: "B", compass: null, voiceKit: null, voiceLessons: [], platforms: ["instagram", "threads"] }, u, [], 300);
    expect(output.title).toBe("What time really is");
    expect(output.captions).toEqual([{ platform: "threads", body: "a" }, { platform: "instagram", body: "d" }]);
    expect(llm.calls[0]!.prompt).toContain("exactly one per platform for instagram, threads");
  });
});

describe("review chat", () => {
  const ctx = () => ({
    showName: "Human Time with GG",
    episodeTitle: "The watch",
    summary: "s",
    moments: ["When I was nine my grandmother gave me a watch"],
    transcript: "A: When I was nine my grandmother gave me a watch.",
    pieces: [
      { id: "p-title", kind: "title" as const, platform: "", body: "The watch", options: ["The watch", "Time we share"] },
      { id: "p-threads", kind: "caption" as const, platform: "threads", body: "Time is a gift.", options: [] },
    ],
    voiceKit: null,
    voiceLessons: [],
  });

  it("saves the piece the person asked about and says what changed", async () => {
    const llm = new FakeLlm({}, [
      { content: [{ type: "tool_use", id: "c1", name: "save_piece", input: { piece_id: "p-title", body: "The watch my grandmother gave me", note: "longer, more personal" } }], stopReason: "tool_use" },
      { content: [{ type: "text", text: "I made the title more personal." }], stopReason: "end_turn" },
    ]);
    const saved: [string, string, string][] = [];
    const out = await reviewChat(llm, ctx(), [{ role: "user", text: "Make the title more personal" }], async (id, body, note) => {
      saved.push([id, body, note]);
      return 2;
    });
    expect(saved).toEqual([["p-title", "The watch my grandmother gave me", "longer, more personal"]]);
    expect(out).toMatchObject({ reply: "I made the title more personal.", edits: [{ pieceId: "p-title", label: "title", version: 2 }] });
    expect(llm.turns[0]!.system).toContain("[p-threads] threads caption (max 500 characters)");
    expect(llm.turns[1]!.messages.at(-1)).toMatchObject({ role: "user", content: [{ type: "tool_result", tool_use_id: "c1", content: "Saved as version 2." }] });
  });

  it("refuses unknown pieces and text over the limit, and lets the model try again", async () => {
    const llm = new FakeLlm({}, [
      { content: [{ type: "tool_use", id: "c1", name: "save_piece", input: { piece_id: "p-threads", body: "x".repeat(501), note: "n" } }, { type: "tool_use", id: "c2", name: "save_piece", input: { piece_id: "nope", body: "y", note: "n" } }], stopReason: "tool_use" },
      { content: [{ type: "text", text: "That was too long, so I left it." }], stopReason: "end_turn" },
    ]);
    let saves = 0;
    const out = await reviewChat(llm, ctx(), [{ role: "user", text: "Rewrite the Threads post" }], async () => ++saves);
    expect(saves).toBe(0);
    expect(out.edits).toEqual([]);
    const results = llm.turns[1]!.messages.at(-1)!.content as { content: string; is_error?: boolean }[];
    expect(results.map((r) => r.is_error)).toEqual([true, true]);
    expect(results[0]!.content).toMatch(/limit is 500/);
  });
});
