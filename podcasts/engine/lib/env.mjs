// Shared paths, keys and the show loader. The engine knows nothing about any one show:
// everything show-specific comes from podcasts/shows/<show>/show.json and that show's folders.
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const ENGINE = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PODCASTS = join(ENGINE, "..");

export function loadEnv() {
  const file = join(PODCASTS, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing. Add it to podcasts/.env`);
  return v;
}

// A show: its config plus the folders the engine reads from and writes to.
export function loadShow(id = "journeys-with-time") {
  const dir = join(PODCASTS, "shows", id);
  const file = join(dir, "show.json");
  if (!existsSync(file)) throw new Error(`No show "${id}". Expected ${file}`);
  const config = JSON.parse(readFileSync(file, "utf8"));
  const show = {
    id, dir, config,
    brandDir: join(dir, "brand"),
    rulesFile: join(dir, config.rules || "rules/clip-rules.md"),
    templateEntry: join(dir, config.template.entry),
    composition: config.template.composition,
    sceneMeanings: join(dir, config.template.scene_meanings),
    publicDir: join(dir, "public"),
    outDir: join(dir, "out"),
  };
  mkdirSync(show.publicDir, { recursive: true });
  mkdirSync(show.outDir, { recursive: true });
  return show;
}

export const brandKit = (show) => {
  const f = join(show.brandDir, "brand.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
};

// --show <id> from the command line (defaults to Journeys with Time).
export const showArg = (args) => { const i = args.indexOf("--show"); return i >= 0 ? args[i + 1] : "journeys-with-time"; };

export function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "episode";
}

export const log = (...a) => console.log(`[${new Date().toLocaleTimeString("en-GB")}]`, ...a);
