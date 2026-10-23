// Cut every clip's audio, bundle the show's template once (it copies the show's public/ at bundle time),
// then render each clip. The template, composition, plates and folders all come from the show.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { cpus } from "node:os";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { slugify, log, brandKit } from "./env.mjs";

function cutAudio(episodePath, clip, file) {
  const dur = (clip.endMs - clip.startMs) / 1000;
  execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", String(clip.startMs / 1000), "-t", String(dur), "-i", episodePath,
    "-af", `afade=t=in:d=0.08,afade=t=out:st=${Math.max(0, dur - 0.35)}:d=0.35`, "-ac", "2", "-ar", "48000", file]);
}

function wordsFor(t, clip) {
  return t.words
    .filter((w) => w.start >= clip.startMs - 50 && w.end <= clip.endMs + 50)
    .map((w) => ({ text: w.text, start: w.start - clip.startMs, end: w.end - clip.startMs }));
}

// Approved plates: copied into the show's public/brand and paired with scenes as a fallback.
function brandPlates(show) {
  const kit = brandKit(show);
  if (!kit) return { pick: () => undefined };
  const dest = join(show.publicDir, "brand");
  mkdirSync(dest, { recursive: true });
  const avail = {};
  for (const p of kit.plates) {
    for (const ext of ["mp4", "png"]) {
      const src = join(show.brandDir, "plates", `${p.id}.${ext}`);
      if (existsSync(src)) { copyFileSync(src, join(dest, `${p.id}.${ext}`)); avail[p.id] = `brand/${p.id}.${ext}`; break; }
    }
  }
  const byScene = Object.fromEntries(kit.plates.filter((p) => avail[p.id]).map((p) => [p.pairs_with, avail[p.id]]));
  const rotation = kit.plates.map((p) => avail[p.id]).filter(Boolean);
  let k = 0;
  return { pick: (scene) => byScene[scene] || (rotation.length ? rotation[k++ % rotation.length] : undefined) };
}

// The art director's choice for a shot, copied into the show's public/ so the template can read it.
function artFor(show, art, n, i) {
  const a = art?.map?.[n]?.[i];
  if (!a) return undefined;
  if (a.kind === "approved") return existsSync(join(show.publicDir, "brand", `${a.id}.mp4`)) ? `brand/${a.id}.mp4` : undefined;
  const src = join(show.brandDir, "candidates", a.dir, `${a.id}.mp4`);
  if (!existsSync(src)) return undefined;
  mkdirSync(join(show.publicDir, "brand", "cand"), { recursive: true });
  copyFileSync(src, join(show.publicDir, "brand", "cand", `${a.id}.mp4`));
  return `brand/cand/${a.id}.mp4`;
}

export async function renderAll(episodePath, t, plan, outDir, only, directions = {}, art = null, show) {
  const clipsDir = join(show.publicDir, "clips");
  mkdirSync(clipsDir, { recursive: true });
  const plates = brandPlates(show);
  const kit = brandKit(show);
  const jobs = plan.clips.filter((c) => !only || only.includes(c.n)).map((clip) => {
    const name = `${String(clip.n).padStart(2, "0")}-${slugify(clip.title)}`;
    const audioFile = `${slugify(plan.episodeTitle)}-${name}.wav`;
    cutAudio(episodePath, clip, join(clipsDir, audioFile));
    return { clip, name, inputProps: {
      title: clip.title, n: clip.n, total: plan.clips.length, episode: plan.episodeTitle,
      lockup: show.config.lockup, brandVersion: kit?.version ?? null,
      audio: `clips/${audioFile}`, durationMs: clip.endMs - clip.startMs, words: wordsFor(t, clip), loop: null,
      shots: (directions[clip.n] || []).map((s, i) => ({ ...s, art: artFor(show, art, clip.n, i) || plates.pick(s.scene) })),
    } };
  });
  log(`Cut ${jobs.length} audio clips. Bundling the ${show.config.name} template…`);
  const serveUrl = await bundle({ entryPoint: show.templateEntry, publicDir: show.publicDir });
  const results = [];
  for (const { clip, name, inputProps } of jobs) {
    const composition = await selectComposition({ serveUrl, id: show.composition, inputProps });
    const output = join(outDir, `${name}.mp4`);
    log(`Rendering ${clip.n}/${plan.clips.length}: ${clip.title} (${clip.seconds}s)`);
    let last = -1;
    await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: output, inputProps, crf: 18,
      concurrency: Math.max(4, cpus().length - 2),
      onProgress: ({ progress }) => { const p = Math.floor(progress * 10); if (p !== last) { last = p; process.stdout.write(`${p * 10}% `); } } });
    process.stdout.write("\n");
    results.push({ n: clip.n, title: clip.title, file: output, brandVersion: inputProps.brandVersion });
  }
  writeFileSync(join(outDir, "rendered.json"), JSON.stringify(results, null, 2));
  return results;
}
