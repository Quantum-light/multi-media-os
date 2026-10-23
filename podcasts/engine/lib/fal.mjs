// Minimal fal.ai queue client: submit, poll, return the result. Used to make art plates.
import { need, log } from "./env.mjs";

export async function fal(model, input, label = model) {
  const headers = { Authorization: `Key ${need("FAL_KEY")}`, "content-type": "application/json" };
  const sub = await fetch(`https://queue.fal.run/${model}`, { method: "POST", headers, body: JSON.stringify(input) });
  if (!sub.ok) throw new Error(`fal ${model} ${sub.status}: ${await sub.text()}`);
  const { status_url, response_url } = await sub.json();
  for (let i = 0; ; i++) {
    const s = await (await fetch(status_url, { headers })).json();
    if (s.status === "COMPLETED") break;
    if (s.status === "FAILED" || s.error) throw new Error(`fal ${label} failed: ${JSON.stringify(s).slice(0, 300)}`);
    if (i % 6 === 0) log(`${label}: ${s.status.toLowerCase()}…`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  const res = await fetch(response_url, { headers });
  if (!res.ok) throw new Error(`fal ${label} result ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function download(url, file) {
  const { writeFileSync } = await import("node:fs");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}
