// The visual director: for every clip, Claude plans a scene change every 3-6 s that matches what is being said.
// The scene library and its meanings belong to the show's template. Cached as directions.json.
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { log, brandKit } from "./env.mjs";
import { askJSON } from "./claude.mjs";

function phrases(t, clip) {
  const words = t.words.filter((w) => w.start >= clip.startMs - 50 && w.end <= clip.endMs + 50);
  const out = []; let cur = [];
  words.forEach((w, i) => {
    cur.push(w);
    if (cur.length >= 9 || /[.?!,;:]$/.test(w.text) && cur.length >= 4 || i === words.length - 1) {
      out.push(`${cur[0].start - clip.startMs}ms: ${cur.map((x) => x.text).join(" ")}`); cur = [];
    }
  });
  return out.join("\n");
}

function prompt(plan, t, show, meanings, kit) {
  const scenes = Object.keys(meanings);
  const menu = scenes.map((s) => `- ${s}: ${meanings[s]}`).join("\n");
  const preferred = (kit?.plates || []).map((p) => p.pairs_with).filter(Boolean);
  const clips = plan.clips.map((c) => `### Clip ${c.n} — "${c.title}" (${c.endMs - c.startMs} ms long)\n${phrases(t, c)}`).join("\n\n");
  return `You are the visual director for ${show.config.name}, ${show.config.brand_line}.
Each vertical clip shows animated scenes behind the captions. The scene must change every 3–6 seconds
so the picture follows what ${show.config.host} is saying at that moment.${kit ? ` The feeling: ${kit.feeling.core} ${kit.feeling.is.join(", ")}.` : ""}

Scene library (only these names):
${menu}

Rules:
- First shot is at 0 ms and also sits behind the title card, so pick the most evocative scene for the clip.
- Then cut on a phrase start (use the ms values given) every 3–6 s. Never sooner than 2.5 s, never later than 7 s.
- Match the meaning of the words being spoken from that point. Never repeat a scene back to back.${preferred.length ? `
- Prefer ${preferred.join(", ")}: they have approved atmosphere in the ${show.config.name} brand.` : ""}
- "keyword" only for a named concept or coined word said aloud; label = that exact term, max 3 words; at most once per 20 s.
- Every other shot gets a short field-note label, 2–5 lowercase words, true to what is said (e.g. "where time goes").

The clips (phrase start in ms : words):

${clips}

Return ONLY JSON: {"clips":[{"n":1,"shots":[{"atMs":0,"scene":"cone","label":"where time goes"}]}]}`;
}

function clean(shots = [], durationMs, scenes) {
  const out = [];
  for (const s of shots.sort((a, b) => a.atMs - b.atMs)) {
    if (!scenes.includes(s.scene)) continue;
    const atMs = out.length ? Math.max(0, Math.round(s.atMs)) : 0;
    const prev = out[out.length - 1];
    if (prev && (atMs - prev.atMs < 2200 || s.scene === prev.scene)) continue;
    if (atMs > durationMs - 1500) continue;
    out.push({ atMs, scene: s.scene, label: String(s.label || "").slice(0, 40) });
  }
  return out;
}

export async function direct(plan, t, workDir, show) {
  const cache = join(workDir, "directions.json");
  if (existsSync(cache)) { log("Scene directions found, reusing them."); return JSON.parse(readFileSync(cache, "utf8")); }
  const { SCENE_MEANINGS: meanings } = await import(pathToFileURL(show.sceneMeanings).href);
  const scenes = Object.keys(meanings);
  log("Claude is directing the scenes…");
  const parsed = await askJSON(prompt(plan, t, show, meanings, brandKit(show)), 12000);
  const fallback = (d) => Array.from({ length: Math.max(1, Math.floor(d / 4500)) }, (_, i) => ({ atMs: i * 4500, scene: scenes[i % scenes.length], label: "" }));
  const byN = Object.fromEntries(plan.clips.map((c) => {
    const shots = clean(parsed.clips?.find((x) => x.n === c.n)?.shots, c.endMs - c.startMs, scenes);
    return [c.n, shots.length >= 2 ? shots : fallback(c.endMs - c.startMs)];
  }));
  writeFileSync(cache, JSON.stringify(byN, null, 2));
  log(`Directed ${Object.values(byN).reduce((n, s) => n + s.length, 0)} scene changes across ${plan.clips.length} clips.`);
  return byN;
}
