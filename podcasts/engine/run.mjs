#!/usr/bin/env node
// One episode in, a show's clips out. The show decides the brand, rules and visual template.
//   npm run clips -- "/path/to/episode.wav"                         Journeys with Time (default show)
//   npm run clips -- "/path/to/episode.wav" --show <show-id>        any show in podcasts/shows/
//   npm run clips -- "/path/to/episode.wav" --plan                  stop after picking (review the plan first)
//   npm run clips -- "/path/to/episode.wav" --only 1,4              render just those clip numbers
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { loadEnv, loadShow, showArg, slugify, log } from "./lib/env.mjs";
import { transcribe } from "./lib/transcribe.mjs";
import { pick } from "./lib/pick.mjs";
import { direct } from "./lib/direct.mjs";
import { artDirect } from "./lib/art-direct.mjs";
import { renderAll } from "./lib/render.mjs";
import { writeReviewPage } from "./lib/review-page.mjs";

loadEnv();
const args = process.argv.slice(2);
const show = loadShow(showArg(args));
const flagValues = new Set(["--show", "--only"].filter((f) => args.includes(f)).map((f) => args[args.indexOf(f) + 1]));
const episode = args.find((a) => !a.startsWith("--") && !flagValues.has(a));
if (!episode || !existsSync(episode)) {
  console.error('Give me an episode: npm run clips -- "/path/to/episode.wav" [--show journeys-with-time]');
  process.exit(1);
}
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1].split(",").map(Number) : null;

const name = basename(episode, extname(episode));
const outDir = join(show.outDir, slugify(name));
mkdirSync(outDir, { recursive: true });

function review(plan) {
  const rows = plan.clips.map((c) =>
    `## ${c.n}. ${c.title}  (${c.seconds}s, ${c.lengthBand}, ${c.beat})\n` +
    `Scores — hook ${c.scores.hook} · standalone ${c.scores.standalone} · gravitas ${c.scores.gravitas} · accuracy ${c.scores.accuracy}\n\n` +
    `Why: ${c.why}\n\n${c.checkClaim ? `Check before posting: ${c.checkClaim}\n\n` : ""}> ${c.text}\n`);
  writeFileSync(join(outDir, "REVIEW.md"),
    `# ${plan.episodeTitle}\n\nShow: ${show.config.name}\nSource: ${basename(episode)}\nClips are numbered in publishing order.\n\n${rows.join("\n")}`);
}

try {
  log(`${show.config.name} · episode: ${name}`);
  const t = await transcribe(resolve(episode), outDir);
  const plan = await pick(t, name, outDir, show);
  review(plan);
  if (args.includes("--plan")) {
    log(`Plan written to ${join(outDir, "REVIEW.md")}. Run again without --plan to render.`);
  } else {
    const directions = await direct(plan, t, outDir, show);
    const art = await artDirect(plan, t, directions, outDir, show);
    await renderAll(resolve(episode), t, plan, outDir, only, directions, art, show);
    const page = writeReviewPage(plan, outDir, basename(episode), show);
    log(`Done. Watch and approve them here: ${page}`);
    try { execFileSync("open", [page]); } catch {}
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exit(1);
}
