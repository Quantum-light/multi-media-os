// Writes out/<episode>/review.html: every clip playable side by side, in publishing order,
// with why it was chosen and anything to check. Approvals are ticked in the page.
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { slugify } from "./env.mjs";

const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function writeReviewPage(plan, outDir, source, show) {
  const cards = plan.clips.map((c) => {
    const file = `${String(c.n).padStart(2, "0")}-${slugify(c.title)}.mp4`;
    const video = existsSync(join(outDir, file))
      ? `<video src="${file}" controls preload="metadata" playsinline></video>`
      : `<div class="missing">Not rendered yet</div>`;
    return `<article>
  ${video}
  <div class="meta">
    <div class="n">${String(c.n).padStart(2, "0")} · ${c.seconds}s · ${esc(c.lengthBand)} · ${esc(c.beat)}</div>
    <h2>${esc(c.title)}</h2>
    <p>${esc(c.why)}</p>
    ${c.checkClaim ? `<p class="check"><b>Check before posting:</b> ${esc(c.checkClaim)}</p>` : ""}
    <label><input type="checkbox" data-id="${c.n}"> Approved</label>
  </div>
</article>`;
  }).join("\n");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(plan.episodeTitle)} — clips</title>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500&family=Crimson+Pro:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
<style>
body{margin:0;background:#150A26;color:#F4F1F8;font-family:'Crimson Pro',Georgia,serif}
header{padding:40px 32px 8px}header .k{font-family:Cinzel,serif;letter-spacing:.32em;font-size:13px;color:#C8C1D8}
h1{font-family:Cinzel,serif;font-weight:500;font-size:34px;letter-spacing:.04em;margin:10px 0 4px}
header p{color:#C8C1D8;margin:0;font-size:18px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:28px;padding:28px 32px 60px}
article{background:#22103C;border:1px solid rgba(200,193,216,.18);border-radius:10px;overflow:hidden}
video,.missing{width:100%;aspect-ratio:9/16;display:block;background:#0E0718}
.missing{display:flex;align-items:center;justify-content:center;color:#A69CBC}
.meta{padding:14px 16px 18px}.n{font-size:14px;color:#C8C1D8;font-style:italic}
h2{font-family:Cinzel,serif;font-weight:500;font-size:18px;letter-spacing:.04em;margin:6px 0 8px}
p{font-size:16px;line-height:1.4;margin:0 0 10px;color:#DCD6E6}.check{color:#E9C27A}
label{display:flex;gap:8px;align-items:center;font-size:17px;cursor:pointer}input{width:20px;height:20px;accent-color:#D9A84E}
</style></head><body>
<header><div class="k">${esc(show.config.name.toUpperCase())} · CLIP REVIEW</div><h1>${esc(plan.episodeTitle)}</h1>
<p>From ${esc(source)} · ${plan.clips.length} clips in publishing order</p></header>
<main>
${cards}
</main>
<script>
const key='approvals:'+location.pathname;let s={};try{s=JSON.parse(localStorage.getItem(key)||'{}')}catch(e){}
document.querySelectorAll('input[data-id]').forEach(b=>{b.checked=!!s[b.dataset.id];b.onchange=()=>{s[b.dataset.id]=b.checked;try{localStorage.setItem(key,JSON.stringify(s))}catch(e){}}});
</script></body></html>`;
  const file = join(outDir, "review.html");
  writeFileSync(file, html);
  return file;
}
