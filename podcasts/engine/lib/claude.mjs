// One place to ask Claude for JSON. Retries when the reply is cut short or isn't valid JSON.
import { need, log } from "./env.mjs";

export async function askJSON(prompt, maxTokens = 8000, tries = 3) {
  let last;
  for (let i = 1; i <= tries; i++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": need("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.CLIP_MODEL || "claude-opus-5-5", max_tokens: maxTokens,
        messages: [{ role: "user", content: i === 1 ? prompt : `${prompt}\n\nReturn strictly valid JSON: escape any double quotes inside strings.` }] }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
    const raw = (await res.json()).content.map((c) => c.text || "").join("");
    try { return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); }
    catch (e) { last = e; if (i < tries) log(`Claude's reply wasn't clean JSON (${e.message.slice(0, 60)}); asking again…`); }
  }
  throw last;
}
