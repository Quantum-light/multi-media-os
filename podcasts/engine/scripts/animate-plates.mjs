// Animates a show's approved brand plates into slow 10 s loops (Kling via fal), then makes a light copy for rendering.
//   node engine/scripts/animate-plates.mjs [--show journeys-with-time] [plate-id ...]
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { loadEnv, loadShow, showArg, brandKit, log } from "../lib/env.mjs";
import { fal, download } from "../lib/fal.mjs";

loadEnv();
const args = process.argv.slice(2);
const show = loadShow(showArg(args));
const kit = brandKit(show);
const dir = join(show.brandDir, "plates");
const MOTION = kit.art_direction.motion_prompt;
const named = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--show");
const ids = named.length ? named : kit.plates.map((p) => p.id);

for (const id of ids) {
  const out = join(dir, `${id}.mp4`);
  if (existsSync(out)) { log(`${id}: loop exists`); continue; }
  const jpg = join(dir, `_${id}.jpg`);
  execFileSync("sips", ["-Z", "1536", "-s", "format", "jpeg", join(dir, `${id}.png`), "--out", jpg], { stdio: "ignore" });
  const r = await fal("fal-ai/kling-video/v2.1/standard/image-to-video", {
    prompt: MOTION, image_url: `data:image/jpeg;base64,${readFileSync(jpg).toString("base64")}`, duration: "10",
    negative_prompt: "glow, neon, sparkle, fast motion, cuts, faces, text, new objects",
  }, `loop ${id}`);
  const raw = join(dir, `_${id}-raw.mp4`);
  await download(r.video.url, raw);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", raw, "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
    "-an", "-c:v", "libx264", "-crf", "23", "-preset", "medium", "-pix_fmt", "yuv420p", out]);
  log(`${id}: loop ready`);
}
log("ANIM_DONE");
