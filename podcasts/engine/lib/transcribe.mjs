// AssemblyAI: upload the episode, get words + sentences with millisecond timings.
// The result is cached next to the run so re-runs never pay twice.
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { need, log } from "./env.mjs";

const API = "https://api.assemblyai.com/v2";

async function call(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: need("ASSEMBLYAI_API_KEY"), ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`AssemblyAI ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function transcribe(episodePath, workDir) {
  const cache = join(workDir, "transcript.json");
  if (existsSync(cache)) {
    log("Transcript found, reusing it.");
    return JSON.parse(readFileSync(cache, "utf8"));
  }
  // A small mono mp3 uploads in seconds instead of a 130 MB wav.
  const mp3 = join(workDir, "upload.mp3");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", episodePath, "-ac", "1", "-ar", "22050", "-b:a", "64k", mp3]);
  log("Uploading audio to AssemblyAI…");
  const { upload_url } = await call("/upload", { method: "POST", body: readFileSync(mp3) });
  const job = await call("/transcript", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ audio_url: upload_url, punctuate: true, format_text: true, language_code: "en" }),
  });
  log("Transcribing…");
  let t;
  for (;;) {
    t = await call(`/transcript/${job.id}`);
    if (t.status === "completed") break;
    if (t.status === "error") throw new Error(`AssemblyAI error: ${t.error}`);
    await new Promise((r) => setTimeout(r, 4000));
  }
  const { sentences } = await call(`/transcript/${job.id}/sentences`);
  const out = {
    id: job.id,
    durationMs: Math.round((t.audio_duration || 0) * 1000),
    text: t.text,
    words: t.words.map((w) => ({ text: w.text, start: w.start, end: w.end })),
    sentences: sentences.map((s, i) => ({ i, text: s.text, start: s.start, end: s.end })),
  };
  writeFileSync(cache, JSON.stringify(out, null, 1));
  log(`Transcript ready: ${out.sentences.length} sentences, ${Math.round(out.durationMs / 60000)} min.`);
  return out;
}
