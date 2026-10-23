// Brand lab: atmosphere-only plates guided by reference images, composited with the show's template
// (line work + caption) and shown on a page to approve or reject. Each round is a file in the show's brand/lab/.
//   node engine/scripts/brand-lab.mjs <round-name> [--show journeys-with-time]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { loadEnv, loadShow, showArg, brandKit, log } from "../lib/env.mjs";
import { fal, download } from "../lib/fal.mjs";

loadEnv();
const args = process.argv.slice(2);
const show = loadShow(showArg(args));
const round = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--show") || "round-1";
const spec = JSON.parse(readFileSync(join(show.brandDir, "lab", `${round}.json`), "utf8"));
const INSP = spec.references_folder.replace(/^~/, process.env.HOME);
const artDir = join(show.publicDir, "lab", round);
const outDir = join(show.outDir, "brand-lab", round);
mkdirSync(artDir, { recursive: true }); mkdirSync(outDir, { recursive: true });
const STYLE = brandKit(show).art_direction.style_prompt;
const PLATES = spec.plates;

function dataUri(file) {
  const tmp = join(artDir, "_ref.jpg");
  execFileSync("sips", ["-Z", "1024", "-s", "format", "jpeg", file, "--out", tmp], { stdio: "ignore" });
  return `data:image/jpeg;base64,${readFileSync(tmp).toString("base64")}`;
}

for (const p of PLATES) {
  const file = join(artDir, `${p.id}.png`);
  if (existsSync(file)) continue;
  const r = await fal("fal-ai/flux-pro/v1.1-ultra", {
    prompt: `${p.prompt}. ${STYLE}`, aspect_ratio: "9:16", output_format: "png", safety_tolerance: "2",
    image_url: dataUri(join(INSP, p.ref)), image_prompt_strength: spec.reference_strength ?? 0.22,
  }, `plate ${p.id}`);
  await download(r.images[0].url, file);
  log(`plate ready: ${p.id}`);
}

log("Compositing with the gold line work…");
const serveUrl = await bundle({ entryPoint: show.templateEntry, publicDir: show.publicDir });
const words = spec.sample_caption
  .split(" ").map((text, i) => ({ text, start: i * 330, end: i * 330 + 300 }));
for (const p of PLATES) {
  const inputProps = { title: "Where does time go?", n: 1, total: 10, audio: "", durationMs: 6000, loop: null, words,
    lockup: show.config.lockup, shots: [{ atMs: 0, scene: p.scene, label: p.label, art: `lab/${round}/${p.id}.png` }] };
  const composition = await selectComposition({ serveUrl, id: show.composition, inputProps });
  await renderStill({ composition, serveUrl, inputProps, frame: 45 + 66, output: join(outDir, `${p.id}.png`), scale: 0.5 });
  log(`frame ready: ${p.id}`);
}

const cards = PLATES.map((p, i) => `<article><img src="${p.id}.png" alt="">
<div class="m"><div class="n">${String(i + 1).padStart(2, "0")} · ${p.id.replace(/-/g, " ")} · ${p.scene}</div>
<div class="b"><button data-v="yes" data-id="${p.id}">Yes</button><button data-v="no" data-id="${p.id}">No</button></div>
<input data-r="${p.id}" placeholder="why, in a few words"></div></article>`).join("\n");
writeFileSync(join(outDir, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${show.config.name} — brand lab ${round}</title>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500&family=Crimson+Pro:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
<style>body{margin:0;background:#150A26;color:#F4F1F8;font-family:'Crimson Pro',Georgia,serif}
header{padding:36px 32px 6px}.k{font-family:Cinzel,serif;letter-spacing:.32em;font-size:13px;color:#C8C1D8}
h1{font-family:Cinzel,serif;font-weight:500;font-size:30px;margin:8px 0}header p{color:#C8C1D8;margin:0;font-size:18px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:26px;padding:26px 32px}
article{background:#22103C;border:1px solid rgba(200,193,216,.18);border-radius:10px;overflow:hidden}img{width:100%;display:block}
.m{padding:12px 14px 16px;display:flex;flex-direction:column;gap:10px}.n{font-size:16px;color:#C8C1D8;font-style:italic}
.b{display:flex;gap:8px}button{flex:1;min-height:44px;border-radius:6px;border:1px solid #C8C1D8;background:transparent;color:#F4F1F8;font:inherit;font-size:17px;cursor:pointer}
button.on[data-v=yes]{background:#D9A84E;color:#150A26;border-color:#D9A84E}button.on[data-v=no]{background:#40205E}
input{min-height:40px;border-radius:6px;border:1px solid rgba(200,193,216,.4);background:#150A26;color:#F4F1F8;font:inherit;font-size:16px;padding:0 10px}
footer{padding:0 32px 48px}#copy{min-height:48px;padding:0 22px;background:#D9A84E;color:#150A26;border:0;border-radius:6px;font:inherit;font-size:18px;cursor:pointer}
#out{white-space:pre-wrap;color:#C8C1D8;margin-top:12px}</style></head><body>
<header><div class="k">${show.config.name.toUpperCase()} · BRAND LAB</div><h1>${round.replace("-", " ")}</h1>
<p>Atmosphere made by AI from your references, gold line work drawn in code, caption on top. Mark each yes or no and say why.</p></header>
<main>${cards}</main>
<footer><button id="copy">Copy my picks to send to Claude</button><div id="out"></div></footer>
<script>const k='lab:${round}';let s={};try{s=JSON.parse(localStorage.getItem(k)||'{}')}catch(e){}
const save=()=>{try{localStorage.setItem(k,JSON.stringify(s))}catch(e){}};
document.querySelectorAll('button[data-v]').forEach(b=>{const id=b.dataset.id;if(s[id]&&s[id].v===b.dataset.v)b.classList.add('on');
b.onclick=()=>{s[id]={...(s[id]||{}),v:b.dataset.v};save();document.querySelectorAll('button[data-id="'+id+'"]').forEach(x=>x.classList.toggle('on',x===b))}});
document.querySelectorAll('input[data-r]').forEach(i=>{const id=i.dataset.r;i.value=(s[id]&&s[id].r)||'';i.oninput=()=>{s[id]={...(s[id]||{}),r:i.value};save()}});
document.getElementById('copy').onclick=async()=>{const t=Object.entries(s).map(([id,x])=>id+': '+(x.v||'?')+(x.r?' — '+x.r:'')).join('\\n');
document.getElementById('out').textContent=t;try{await navigator.clipboard.writeText(t)}catch(e){}};</script></body></html>`);
execFileSync("open", [join(outDir, "index.html")]);
log("LAB_DONE");
