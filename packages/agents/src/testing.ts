import type { z } from "zod";
import type { Llm, Message, TextBlock, ToolSpec, ToolUseBlock, Usage } from "./anthropic";

type Structured = { tool: string; system: string; prompt: string };
type Turn = { content: (TextBlock | ToolUseBlock)[]; stopReason: string };

/**
 * A stand-in for the model in tests: answers each structured call from a table keyed by
 * tool name, and plays scripted turns for tool loops. Records every request it saw.
 */
export class FakeLlm implements Llm {
  readonly model = "fake-model";
  readonly calls: Structured[] = [];
  readonly turns: { system: string; messages: Message[]; tools: ToolSpec[] }[] = [];
  constructor(
    private readonly answers: Record<string, unknown | ((prompt: string) => unknown)> = {},
    private readonly script: Turn[] = [],
  ) {}

  async structured<S extends z.ZodTypeAny>(req: { system: string; prompt: string; tool: { name: string; schema: S } }): Promise<{ data: z.output<S>; usage: Usage }> {
    this.calls.push({ tool: req.tool.name, system: req.system, prompt: req.prompt });
    const answer = this.answers[req.tool.name];
    if (answer === undefined) throw new Error(`FakeLlm has no answer for ${req.tool.name}`);
    const raw = typeof answer === "function" ? (answer as (p: string) => unknown)(req.prompt) : answer;
    const parsed = req.tool.schema.safeParse(raw);
    if (!parsed.success) throw new Error(`The model's ${req.tool.name} did not pass its checks`);
    return { data: parsed.data, usage: { inputTokens: 1000, outputTokens: 200 } };
  }

  async turn(req: { system: string; messages: Message[]; tools: ToolSpec[] }) {
    this.turns.push({ system: req.system, messages: structuredClone(req.messages), tools: req.tools });
    const next = this.script.shift();
    if (!next) return { content: [{ type: "text" as const, text: "Done." }], stopReason: "end_turn", usage: { inputTokens: 100, outputTokens: 10 } };
    return { ...next, usage: { inputTokens: 100, outputTokens: 10 } };
  }
}
