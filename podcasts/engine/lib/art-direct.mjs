// Art director: gives every shot its own atmosphere, matched to what is being said.
// Reuses the show's approved plates where they fit and invents new ones, made in the style of the approved plates
// (they are the reference image), so each episode adds to the library while staying in the same world.
// New plates are candidates until they are approved in the brand lab. All style comes from the show's brand.json.
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { need, log, slugify, brandKit } from "./env.mjs";
import { fal, download } from "./fal.mjs";
import { askJSON } from "./claude.mjs";


function phrasesAt(t, clip, shots) {
  return shots.map((s, i) => {
    const from = clip.startMs + s.atMs, to = clip.startMs + (shots[i + 1]?.atMs ?? clip.endMs - clip.startMs);
    const words = t.words.filter((w) => w.start >= from && w.start < to).map((w) => w.text).join(" ");
    return `  shot ${i} [${s.scene}${s.label ? `, "${s.label}"` : ""}]: ${words}`;
  }).join("\n");
}

async function askClaude(text) {
  return askJSON(text, 16000);
}

async function pool(items, n, fn) {
  const q = [...items]; await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()); }));
}

export async function artDirect(plan, t, directions, workDir, show, lockedClips = [1]) {
  const cache = join(workDir, "art.json");
  if (existsSync(cache)) { log("Art direction found, reusing it."); return JSON.parse(readFileSync(cache, "utf8")); }
  const kit = brandKit(show);
  if (!kit) { log("No brand kit for this show; skipping art direction."); return null; }
  const STYLE = kit.art_direction.style_prompt, MOTION = kit.art_direction.motion_prompt;
  const [minNew, maxNew] = kit.art_direction.new_plates_per_clip || [2, 4], cap = kit.art_direction.max_new_plates_per_episode || 24;
  const approved = kit.plates.map((p) => `- ${p.id}: ${p.means}`).join("\n");
  const clips = plan.clips.filter((c) => !lockedClips.includes(c.n) && directions[c.n])
    .map((c) => `### Clip ${c.n} — "${c.title}"\n${phrasesAt(t, c, directions[c.n])}`).join("\n\n");
  const planCache = join(workDir, "art-plan.json");
  const out = existsSync(planCache) ? JSON.parse(readFileSync(planCache, "utf8")) : await (async () => {
    log("Claude is art-directing the atmospheres…");
    const o = await askClaude(`You are the art director for ${show.config.name}, ${show.config.brand_line}.
Each shot has gold line work drawn in code (the scene in brackets). Behind it sits an atmosphere plate: AI-made, atmosphere only.
Brand: ${kit.art_direction.principle} Atmosphere means ${kit.art_direction.atmosphere}.
Never: ${kit.never_do.join("; ")}.

Approved plates you may reuse:
${approved}

For every shot below, choose the atmosphere that connects to what is being said at that moment.
Rules:
- Every clip must feel different from the others: give each clip ${minNew}–${maxNew} NEW plates of its own, and never open two clips on the same plate.
- Use any single plate at most twice across the whole episode. At most ${cap} new plates in total.
- A new plate is atmosphere only (haze, veils, mist, void, horizons, light moving through darkness, dust, depth, water, sky), never objects, people, symbols or text.
  Its prompt says what the atmosphere looks like in one sentence, true to the moment; "ref" names the approved plate whose style it should follow.
- Reusing a new plate within the same clip is fine.

Shots:
${clips}

Return ONLY JSON: {"clips":[{"n":2,"shots":[{"plate":"misty-horizon"},{"new":{"id":"kebab-case-id","prompt":"…","ref":"deep-veil","means":"what it stands for"}},{"plate":"kebab-case-id"}]}]}
(one entry per shot, in order; a later shot may name a new plate by its id once it has been defined).`);
    writeFileSync(planCache, JSON.stringify(o, null, 2));
    return o;
  })();

  const epDir = join(show.brandDir, "candidates", slugify(plan.episodeTitle));
  mkdirSync(epDir, { recursive: true });
  const known = new Set(kit.plates.map((p) => p.id));
  const fresh = {};
  for (const c of out.clips || []) for (const s of c.shots || []) if (s.new && !known.has(s.new.id)) fresh[s.new.id] = s.new;
  const ids = Object.keys(fresh).slice(0, cap);
  log(`Making ${ids.length} new atmospheres in the ${show.config.name} style…`);

  await pool(ids, 4, async (id) => {
    const p = fresh[id];
    const png = join(epDir, `${id}.png`), mp4 = join(epDir, `${id}.mp4`);
    if (!existsSync(png)) {
      const ref = join(show.brandDir, "plates", `${known.has(p.ref) ? p.ref : "deep-veil"}.png`);
      const jpg = join(epDir, `_ref-${id}.jpg`);
      execFileSync("sips", ["-Z", "1024", "-s", "format", "jpeg", ref, "--out", jpg], { stdio: "ignore" });
      const r = await fal("fal-ai/flux-pro/v1.1-ultra", { prompt: `${p.prompt}. ${STYLE}`, aspect_ratio: "9:16", output_format: "png",
        safety_tolerance: "2", image_url: `data:image/jpeg;base64,${readFileSync(jpg).toString("base64")}`, image_prompt_strength: 0.18 }, `still ${id}`);
      await download(r.images[0].url, png);
    }
    if (!existsSync(mp4)) {
      const jpg = join(epDir, `_${id}.jpg`);
      execFileSync("sips", ["-Z", "1536", "-s", "format", "jpeg", png, "--out", jpg], { stdio: "ignore" });
      const v = await fal("fal-ai/kling-video/v2.1/standard/image-to-video", { prompt: MOTION, duration: "10",
        image_url: `data:image/jpeg;base64,${readFileSync(jpg).toString("base64")}`, negative_prompt: "glow, neon, sparkle, fast motion, cuts, faces, text, new objects" }, `loop ${id}`);
      const raw = join(epDir, `_${id}-raw.mp4`);
      await download(v.video.url, raw);
      execFileSync("ffmpeg", ["-y", "-v", "error", "-i", raw, "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
        "-an", "-c:v", "libx264", "-crf", "23", "-preset", "medium", "-pix_fmt", "yuv420p", mp4]);
    }
    log(`atmosphere ready: ${id}`);
  });

  // Map every shot to a file path the renderer can use.
  const map = {};
  for (const c of out.clips || []) {
    map[c.n] = (c.shots || []).map((s) => {
      const id = s.new ? s.new.id : s.plate;
      if (known.has(id)) return { id, kind: "approved" };
      if (fresh[id] && existsSync(join(epDir, `${id}.mp4`))) return { id, kind: "candidate", dir: slugify(plan.episodeTitle) };
      return null;
    });
  }
  const record = { map, candidates: ids.map((id) => ({ id, ...fresh[id], status: "pending" })) };
  writeFileSync(cache, JSON.stringify(record, null, 2));
  writeFileSync(join(epDir, "candidates.json"), JSON.stringify(record.candidates, null, 2));
  return record;
}
