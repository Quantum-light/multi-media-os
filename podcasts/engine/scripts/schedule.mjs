// Schedule a show's approved clips through Zernio. Voice, call to action, hashtags, days, time and accounts come from show.json.
//   npm run schedule -- <episode> --approved 1,2,5 [--start YYYY-MM-DD] [--show journeys-with-time]
//   <episode> is the episode folder name in the show's out/ (e.g. the-new-science-of-time) or a full path.
//   Without --go it is a dry run: it writes captions.json + schedule.json for you to check and shows the accounts it will use.
//   Add --go to upload the videos and book the posts.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve, isAbsolute } from "node:path";
import { loadEnv, loadShow, showArg, need, log } from "../lib/env.mjs";
import { listAccounts, uploadVideo, schedulePost } from "../lib/zernio.mjs";

loadEnv();
const args = process.argv.slice(2);
const show = loadShow(showArg(args));
const cfg = show.config;
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const ep = args[0] || "";
const dir = isAbsolute(ep) || ep.startsWith(".") ? resolve(ep) : join(show.outDir, ep);
const approved = (opt("approved", "") || "").split(",").map(Number).filter(Boolean);
const days = (opt("days") || cfg.schedule.days.join(",")).split(",");
const times = String(opt("time", cfg.schedule.time)).split(","); // "08:00" or "08:00,18:00" for several a day
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; // local date, safe across clock changes
// Default start: the day after the last clip already booked for this show (any episode), else tomorrow.
function nextFreeDay() {
  let last = null;
  for (const e of existsSync(show.outDir) ? readdirSync(show.outDir) : []) {
    const f = join(show.outDir, e, "schedule.json");
    if (!existsSync(f)) continue;
    for (const s of JSON.parse(readFileSync(f, "utf8")).schedule || []) if (s.zernioPostId && (!last || s.when > last)) last = s.when;
  }
  const d = last ? new Date(`${last.slice(0, 10)}T12:00:00`) : new Date();
  d.setDate(d.getDate() + 1);
  return ymd(d);
}
const start = new Date(`${opt("start", nextFreeDay())}T12:00:00`);
const go = args.includes("--go");
if (!existsSync(join(dir, "plan.json")) || !approved.length) {
  console.error("Usage: npm run schedule -- <episode> --approved 1,2,5 [--start YYYY-MM-DD] [--days mon,wed,fri] [--time 08:00 or 08:00,18:00] [--go]");
  process.exit(1);
}
const plan = JSON.parse(readFileSync(join(dir, "plan.json"), "utf8"));
const clips = plan.clips.filter((c) => approved.includes(c.n)).sort((a, b) => a.n - b.n);

const DOW = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const slots = []; const d = new Date(start);
while (slots.length < clips.length) {
  if (days.map((x) => DOW[x]).includes(d.getDay())) for (const t of times) if (slots.length < clips.length) slots.push(`${ymd(d)}T${t}:00`);
  d.setDate(d.getDate() + 1);
}

const capFile = join(dir, "captions.json");
let captions = existsSync(capFile) ? JSON.parse(readFileSync(capFile, "utf8")) : {};
// Grace edits CAPTIONS.txt by hand; whatever is in it wins over captions.json.
const txt = join(dir, "CAPTIONS.txt");
if (existsSync(txt)) {
  for (const block of readFileSync(txt, "utf8").split(/^=+$/m).slice(1)) {
    const lines = block.trim().split("\n");
    const m = lines[0].match(/Reel (\d+):/);
    if (m) captions[m[1]] = lines.slice(1).join("\n").trim();
  }
  writeFileSync(capFile, JSON.stringify(captions, null, 2));
}
const missing = clips.filter((c) => !captions[c.n]);
if (missing.length) {
  log("Claude is writing the captions…");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": need("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.CLIP_MODEL || "claude-opus-5-5", max_tokens: 4000, messages: [{ role: "user", content:
      `Write social captions for ${cfg.name}, ${cfg.brand_line}. Voice: ${cfg.captions.voice}
Each caption: one or two short lines that open the idea without giving it all away, then "${cfg.captions.cta}",
then 4–6 relevant hashtags including ${cfg.captions.hashtags.join(" and ")}.
Return ONLY JSON {"<clip number>": "caption"}.
Episode: ${plan.episodeTitle}
${missing.map((c) => `Clip ${c.n} "${c.title}": ${c.text}`).join("\n")}` }] }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
  const raw = (await res.json()).content.map((c) => c.text || "").join("");
  captions = { ...captions, ...JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) };
  writeFileSync(capFile, JSON.stringify(captions, null, 2));
}

// Only this show's accounts: pinned account ids if set in show.json, otherwise its platforms + usernames.
const all = await listAccounts();
const z = cfg.zernio;
const use = z.account_ids?.length ? all.filter((a) => z.account_ids.includes(a.id))
  : all.filter((a) => z.platforms.includes(a.platform) && (!z.usernames?.length || z.usernames.includes(a.name)));
const dupes = z.platforms.filter((p) => use.filter((a) => a.platform === p).length > 1);

// Never book the same reel twice: keep post ids from an earlier --go run.
const prevFile = join(dir, "schedule.json");
const booked = Object.fromEntries((existsSync(prevFile) ? JSON.parse(readFileSync(prevFile, "utf8")).schedule || [] : [])
  .filter((s) => s.zernioPostId).map((s) => [s.n, s]));
const files = readdirSync(dir).filter((f) => /^\d\d-.*\.mp4$/.test(f));
const schedule = clips.map((c, i) => ({
  n: c.n, title: c.title, when: slots[i], timezone: cfg.schedule.timezone,
  file: join(dir, files.find((f) => f.startsWith(String(c.n).padStart(2, "0") + "-")) || ""), caption: captions[c.n],
  ...(booked[c.n] ? { when: booked[c.n].when, zernioPostId: booked[c.n].zernioPostId } : {}),
}));
writeFileSync(join(dir, "schedule.json"), JSON.stringify({ show: show.id, accounts: use, schedule }, null, 2));

log(`${cfg.name} accounts: ${use.map((a) => `${a.platform} ${a.name} (${a.id})`).join(" · ") || "none found"}`);
for (const s of schedule) log(`${s.when}  clip ${s.n} — ${s.title}`);
if (dupes.length) log(`More than one ${dupes.join(", ")} account matches. Pin the right ones in show.json → zernio.account_ids before --go.`);
if (!go) { log(`Dry run only. Check captions.json and schedule.json in ${dir}.`); process.exit(0); }
if (!use.length) throw new Error("No matching accounts connected in Zernio.");
if (dupes.length) throw new Error("Duplicate accounts match; pin zernio.account_ids in show.json first.");

for (const s of schedule) {
  if (s.zernioPostId) { log(`Clip ${s.n} already booked (${s.zernioPostId}), skipping.`); continue; }
  log(`Uploading clip ${s.n}…`);
  const videoUrl = await uploadVideo(s.file);
  const r = await schedulePost({ content: s.caption, accounts: use, videoUrl, scheduledFor: s.when, timezone: s.timezone });
  s.zernioPostId = r.id ?? r._id ?? r.post?._id;
  log(`Booked clip ${s.n} for ${s.when} (${s.zernioPostId})`);
  writeFileSync(join(dir, "schedule.json"), JSON.stringify({ show: show.id, accounts: use, schedule }, null, 2));
}
log("SCHEDULE_DONE");
