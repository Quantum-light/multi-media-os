// Renders one still per scene into out/scene-sheet/ so the library can be checked by eye.
//   node engine/scripts/scene-sheet.mjs [--show journeys-with-time]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadShow, showArg } from "../lib/env.mjs";
const show = loadShow(showArg(process.argv.slice(2)));
const { SCENE_MEANINGS } = await import(pathToFileURL(show.sceneMeanings).href);

const names = Object.keys(SCENE_MEANINGS);
const shots = names.map((scene, i) => ({ atMs: i * 3000, scene, label: scene === "keyword" ? "Wheeler-DeWitt" : `the ${scene}` }));
const inputProps = { title: "Scene test", n: 1, total: 1, audio: "", durationMs: names.length * 3000 + 2000, loop: null, words: [], shots };
const out = join(show.outDir, "scene-sheet");
mkdirSync(out, { recursive: true });
const serveUrl = await bundle({ entryPoint: show.templateEntry, publicDir: show.publicDir });
const composition = await selectComposition({ serveUrl, id: show.composition, inputProps });
for (const [i, s] of shots.entries()) {
  const frame = 45 + Math.round((s.atMs / 1000) * 30) + 50;
  await renderStill({ composition, serveUrl, inputProps, frame, output: join(out, `${String(i).padStart(2, "0")}-${s.scene}.png`), scale: 0.4 });
  console.log("still", s.scene);
}
console.log("SHEET_DONE");
