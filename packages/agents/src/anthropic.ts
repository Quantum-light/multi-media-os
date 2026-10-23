import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

type Fetch = typeof fetch;

export type Usage = { inputTokens: number; outputTokens: number };
export type TextBlock = { type: "text"; text: string };
export type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };
export type ToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
export type Message = { role: "user" | "assistant"; content: string | (TextBlock | ToolUseBlock | ToolResultBlock)[] };
export type ToolSpec = { name: string; description: string; input_schema: Record<string, unknown> };

/** Thrown when retrying cannot help (a refused key, a request the API calls malformed). */
export class LlmRefused extends Error {
  override readonly name = "LlmRefused";
}

export interface Llm {
  readonly model: string;
  /** One call that must answer by filling in the given schema. Checked with Zod before it is returned. */
  structured<S extends z.ZodTypeAny>(req: { system: string; prompt: string; tool: { name: string; description: string; schema: S }; maxTokens?: number; signal?: AbortSignal }): Promise<{ data: z.output<S>; usage: Usage }>;
  /** One raw turn, for tool loops (the Review chat). */
  turn(req: { system: string; messages: Message[]; tools: ToolSpec[]; maxTokens?: number; signal?: AbortSignal }): Promise<{ content: (TextBlock | ToolUseBlock)[]; stopReason: string; usage: Usage }>;
}

export function jsonSchemaOf(schema: z.ZodTypeAny): Record<string, unknown> {
  const js = zodToJsonSchema(schema, { target: "jsonSchema7", $refStrategy: "none" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

export type AnthropicOptions = { apiKey: string; model?: string; fetch?: Fetch; baseUrl?: string };

/** The model the agents use unless ANTHROPIC_MODEL says otherwise: fast enough for the 10-minute budget. */
export const DEFAULT_MODEL = "claude-sonnet-5-5";

/** The Anthropic Messages API over plain HTTPS. */
export function anthropic(opts: AnthropicOptions): Llm {
  const model = opts.model ?? DEFAULT_MODEL;
  const doFetch = opts.fetch ?? fetch;
  const url = `${(opts.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`;

  async function send(body: Record<string, unknown>, signal?: AbortSignal) {
    const res = await doFetch(url, {
      method: "POST",
      headers: { "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, ...body }),
      ...(signal ? { signal } : {}),
    });
    const text = await res.text();
    if (res.status === 401 || res.status === 403) throw new LlmRefused(`Anthropic refused the key (${res.status}). Check ANTHROPIC_API_KEY.`);
    if (res.status === 400 || res.status === 404) throw new LlmRefused(`Anthropic rejected the request: ${text.slice(0, 300)}`);
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
    const json = JSON.parse(text) as { content: (TextBlock | ToolUseBlock | { type: string })[]; stop_reason: string; usage: { input_tokens: number; output_tokens: number } };
    return {
      content: json.content.filter((b): b is TextBlock | ToolUseBlock => b.type === "text" || b.type === "tool_use"),
      stopReason: json.stop_reason,
      usage: { inputTokens: json.usage.input_tokens, outputTokens: json.usage.output_tokens },
    };
  }

  return {
    model,
    async structured({ system, prompt, tool, maxTokens, signal }) {
      const spec = { name: tool.name, description: tool.description, input_schema: jsonSchemaOf(tool.schema) };
      const out = await send({ max_tokens: maxTokens ?? 8000, system, messages: [{ role: "user", content: prompt }], tools: [spec], tool_choice: { type: "tool", name: tool.name } }, signal);
      const call = out.content.find((b): b is ToolUseBlock => b.type === "tool_use" && b.name === tool.name);
      if (!call) throw new Error(`The model did not fill in ${tool.name} (stopped: ${out.stopReason})`);
      const parsed = tool.schema.safeParse(call.input);
      if (!parsed.success) {
        const issues = parsed.error.issues.slice(0, 3).map((i: z.ZodIssue) => `${i.path.join(".") || "(root)"} ${i.message}`).join("; ");
        throw new Error(`The model's ${tool.name} did not pass its checks: ${issues}`);
      }
      return { data: parsed.data, usage: out.usage };
    },
    turn({ system, messages, tools, maxTokens, signal }) {
      return send({ max_tokens: maxTokens ?? 4000, system, messages, tools }, signal);
    },
  };
}

/** Rough cost in pence (Sonnet-class prices by default, $2 / $10 per million tokens, at 0.79 GBP per USD). */
export function costPence(usage: Usage, rates = { inputUsdPerM: 2, outputUsdPerM: 10, gbpPerUsd: 0.79 }): number {
  const usd = (usage.inputTokens * rates.inputUsdPerM + usage.outputTokens * rates.outputUsdPerM) / 1_000_000;
  return Math.ceil(usd * rates.gbpPerUsd * 100);
}

export function addUsage(a: Usage, b: Usage): Usage {
  return { inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens };
}
