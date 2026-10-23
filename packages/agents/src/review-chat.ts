import { TEXT_LIMITS, type Platform } from "@mmos/contracts";
import { addUsage, type Llm, type Message, type TextBlock, type ToolResultBlock, type ToolUseBlock, type Usage } from "./anthropic";
import { HUMAN_SOURCED, voiceBrief, type Lesson } from "./voice";

export type ChatPiece = { id: string; kind: "title" | "description" | "chapters" | "caption"; platform: string; body: string; options: string[] };

export type ChatContext = {
  showName: string;
  episodeTitle: string;
  summary: string;
  moments: string[];
  /** Plain transcript text, trimmed to fit. */
  transcript: string;
  pieces: ChatPiece[];
  voiceKit: unknown;
  voiceLessons: readonly Lesson[];
};

export type ChatTurn = { role: "user" | "assistant"; text: string };
export type ChatEdit = { pieceId: string; label: string; version: number };

/** What the chat may do: save a new version of one piece. Saving is done by the caller (save_piece). */
export type SavePiece = (pieceId: string, body: string, note: string) => Promise<number>;

const MAX_ROUNDS = 4;

export function pieceLabel(p: Pick<ChatPiece, "kind" | "platform">): string {
  if (p.kind === "caption") return `${p.platform} caption`;
  return p.kind === "chapters" ? "chapter list" : p.kind;
}

function limitOf(p: ChatPiece): number {
  if (p.kind === "title") return TEXT_LIMITS.title;
  if (p.kind === "caption") return TEXT_LIMITS.caption[p.platform as Platform] ?? 2200;
  return TEXT_LIMITS.description;
}

export const EDIT_TOOL = {
  name: "save_piece",
  description: "Save new text for one piece. Use only when the person asked for a change. The old text is kept as a version.",
  input_schema: {
    type: "object",
    properties: {
      piece_id: { type: "string", description: "The id of the piece to change, from the list." },
      body: { type: "string", description: "The complete new text." },
      note: { type: "string", description: "Five words or fewer on what changed." },
    },
    required: ["piece_id", "body", "note"],
  },
} as const;

export function chatSystem(ctx: ChatContext): string {
  return [
    `You are the Review editor for "${ctx.showName}". The creator is reviewing the episode "${ctx.episodeTitle}" and talks to you to change any piece of its published text.`,
    HUMAN_SOURCED,
    voiceBrief(ctx.voiceKit, ctx.voiceLessons),
    "When asked for a change, call save_piece with the complete new text, then say in one short sentence what you changed. When asked a question, answer briefly without saving. Never change a piece the person did not ask about. Keep every limit.",
    `What the episode covers: ${ctx.summary}`,
    ctx.moments.length ? `Moments in their words:\n${ctx.moments.map((m) => `- ${m}`).join("\n")}` : "",
    `The pieces:\n${ctx.pieces.map((p) => `[${p.id}] ${pieceLabel(p)} (max ${limitOf(p)} characters)${p.options.length > 1 ? ` · other title options: ${p.options.slice(1).join(" | ")}` : ""}:\n${p.body}`).join("\n\n")}`,
    `Transcript (for checking what was said):\n${ctx.transcript.slice(0, 60_000)}`,
  ].filter(Boolean).join("\n\n");
}

/**
 * One chat exchange: the model may save pieces (through `save`) and then answers.
 * Edits are checked here (known piece, inside its limit) before anything is saved.
 */
export async function reviewChat(llm: Llm, ctx: ChatContext, history: readonly ChatTurn[], save: SavePiece, signal?: AbortSignal): Promise<{ reply: string; edits: ChatEdit[]; usage: Usage }> {
  const messages: Message[] = history.slice(-12).map((t) => ({ role: t.role, content: t.text }));
  const edits: ChatEdit[] = [];
  let usage: Usage = { inputTokens: 0, outputTokens: 0 };
  const system = chatSystem(ctx);

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const out = await llm.turn({ system, messages, tools: [EDIT_TOOL as unknown as { name: string; description: string; input_schema: Record<string, unknown> }], maxTokens: 3000, ...(signal ? { signal } : {}) });
    usage = addUsage(usage, out.usage);
    const calls = out.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
    if (calls.length === 0) {
      const reply = out.content.filter((b): b is TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
      return { reply: reply || (edits.length ? "Saved." : "I have nothing to add."), edits, usage };
    }
    messages.push({ role: "assistant", content: out.content });
    const results: ToolResultBlock[] = [];
    for (const call of calls) results.push(await applyEdit(call, ctx, save, edits));
    messages.push({ role: "user", content: results });
  }
  return { reply: edits.length ? "Saved your changes." : "I could not finish that; try asking in a different way.", edits, usage };
}

async function applyEdit(call: ToolUseBlock, ctx: ChatContext, save: SavePiece, edits: ChatEdit[]): Promise<ToolResultBlock> {
  const input = (call.input ?? {}) as { piece_id?: unknown; body?: unknown; note?: unknown };
  const piece = ctx.pieces.find((p) => p.id === input.piece_id);
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const fail = (content: string): ToolResultBlock => ({ type: "tool_result", tool_use_id: call.id, content, is_error: true });
  if (call.name !== EDIT_TOOL.name || !piece) return fail("No such piece. Use an id from the list.");
  if (!body) return fail("The new text is empty.");
  if (body.length > limitOf(piece)) return fail(`That is ${body.length} characters; the limit is ${limitOf(piece)}. Shorten it and save again.`);
  const version = await save(piece.id, body, typeof input.note === "string" ? input.note.slice(0, 80) : "chat edit");
  piece.body = body;
  edits.push({ pieceId: piece.id, label: pieceLabel(piece), version });
  return { type: "tool_result", tool_use_id: call.id, content: `Saved as version ${version}.` };
}
