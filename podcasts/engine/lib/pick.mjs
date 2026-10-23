// The clip scout: Claude reads the timed transcript and picks 9-12 clips + their order.
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { log } from "./env.mjs";
import { askJSON } from "./claude.mjs";

const BANDS = { short: [12, 32], medium: [28, 62], long: [55, 95] };
const LOOPS = ["sphere", "light-being", "jellyfish", "light-cone", "dove", "cosmic-web", "stardust", "eclipse"];
const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

function prompt(t, name, show) {
  const rules = readFileSync(show.rulesFile, "utf8");
  const lines = t.sentences.map((s) => `[${s.i}] (${mmss(s.start)}–${mmss(s.end)}) ${s.text}`).join("\n");
  return `You are the clip scout for ${show.config.name}, ${show.config.brand_line}.

${rules}

Episode file: "${name}". Below is the full transcript, one sentence per line: [index] (start–end) text.

${lines}

Choose 9–12 clips. A clip is a run of whole sentences from startSentence to endSentence (inclusive).
Return ONLY JSON, no prose, in exactly this shape:
{"episodeTitle":"a short, true title for the whole episode",
 "clips":[{"startSentence":0,"endSentence":0,"lengthBand":"short|medium|long",
   "title":"title card text, max 6 words, no quotes",
   "beat":"wonder|vastness|gravitas|return","loop":"one of ${LOOPS.join("|")}",
   "scores":{"hook":0,"standalone":0,"gravitas":0,"accuracy":0},
   "publishOrder":1,"why":"one sentence on why this clip will travel",
   "checkClaim":"a claim to fact-check before posting, or empty"}]}`;
}

async function askClaude(text) {
  return askJSON(text, 8000);
}

function validate(plan, t) {
  const used = [];
  const clips = [];
  for (const c of plan.clips.sort((a, b) => a.publishOrder - b.publishOrder)) {
    const a = t.sentences[c.startSentence], b = t.sentences[c.endSentence];
    if (!a || !b || c.endSentence < c.startSentence) continue;
    const startMs = Math.max(0, a.start - 120), endMs = b.end + 250;
    const secs = (endMs - startMs) / 1000;
    const [lo, hi] = BANDS[c.lengthBand] || BANDS.medium;
    if (secs < lo || secs > hi + 10) { log(`Skipping "${c.title}": ${secs.toFixed(0)}s is outside ${c.lengthBand}.`); continue; }
    if (used.some(([s, e]) => startMs < e && endMs > s)) { log(`Skipping "${c.title}": overlaps another clip.`); continue; }
    if ((c.scores?.accuracy ?? 10) < 6 || (c.scores?.standalone ?? 10) < 6) continue;
    used.push([startMs, endMs]);
    clips.push({ ...c, loop: LOOPS.includes(c.loop) ? c.loop : "sphere", startMs, endMs, seconds: Math.round(secs),
      text: t.sentences.slice(c.startSentence, c.endSentence + 1).map((s) => s.text).join(" ") });
  }
  return { episodeTitle: plan.episodeTitle, clips: clips.slice(0, 12).map((c, i) => ({ ...c, n: i + 1 })) };
}

export async function pick(t, name, workDir, show) {
  const cache = join(workDir, "plan.json");
  if (existsSync(cache)) { log("Clip plan found, reusing it."); return JSON.parse(readFileSync(cache, "utf8")); }
  log("Claude is choosing the clips…");
  const plan = validate(await askClaude(prompt(t, name, show)), t);
  if (plan.clips.length < 6) throw new Error(`Only ${plan.clips.length} usable clips came back; run again.`);
  writeFileSync(cache, JSON.stringify(plan, null, 2));
  log(`Picked ${plan.clips.length} clips for "${plan.episodeTitle}".`);
  return plan;
}
