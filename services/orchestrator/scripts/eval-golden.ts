/**
 * Scores the agents against one golden episode (evals/golden/<show>/<episode>/).
 *
 *   railway run npx tsx scripts/eval-golden.ts ../../evals/golden/human-time-with-gg/<episode> [--audio path/to/audio]
 *
 * The folder holds `approved.json` (what Grace published: title, description, chapters) and,
 * after the first run, `transcript.json` (so later runs never pay for transcription again).
 * Each run appends one line to `scores.jsonl` and keeps the drafts in `runs/<time>.json`.
 * Needs ANTHROPIC_API_KEY, and ASSEMBLYAI_API_KEY the first time.
 */
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { anthropic, runUnderstand, runWrite } from "@mmos/agents";
import { TranscriptDoc, type Platform } from "@mmos/contracts";
import { planCuts, removedSeconds } from "../src/edit/cut-plan";
import { Approved, score } from "../src/evals/score";
import { assemblyAi } from "../src/providers/assemblyai";

const [dir, flag, audioPath] = process.argv.slice(2);
if (!dir) throw new Error("Usage: eval-golden.ts <golden episode folder> [--audio <file>]");
const env = process.env;
if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");

const approved = Approved.parse(JSON.parse(await readFile(join(dir, "approved.json"), "utf-8")));
const show = JSON.parse(await readFile(join(dir, "..", "show.json"), "utf-8")) as { showName: string; brandName: string; compass: Record<string, unknown> | null; voiceKit: unknown; platforms: Platform[] };

const timings: Record<string, number> = {};
const time = async <T>(label: string, work: () => Promise<T>): Promise<T> => {
  const started = Date.now();
  const out = await work();
  timings[label] = Math.round((Date.now() - started) / 100) / 10;
  return out;
};

const transcriptFile = join(dir, "transcript.json");
let doc: TranscriptDoc;
if (existsSync(transcriptFile)) {
  doc = TranscriptDoc.parse(JSON.parse(await readFile(transcriptFile, "utf-8")));
} else {
  if (flag !== "--audio" || !audioPath) throw new Error("No transcript.json yet: pass --audio <file> once");
  if (!env.ASSEMBLYAI_API_KEY) throw new Error("ASSEMBLYAI_API_KEY is not set");
  const base = env.ASSEMBLYAI_BASE_URL ?? "https://api.assemblyai.com";
  doc = await time("transcribe", async () => {
    const up = await fetch(`${base}/v2/upload`, { method: "POST", headers: { authorization: env.ASSEMBLYAI_API_KEY! }, body: await readFile(audioPath) });
    if (!up.ok) throw new Error(`Upload to AssemblyAI failed: ${up.status}`);
    const { upload_url } = (await up.json()) as { upload_url: string };
    const t = await assemblyAi({ apiKey: env.ASSEMBLYAI_API_KEY!, baseUrl: base }).transcribe({ audioUrl: upload_url, keyterms: [show.showName, show.brandName], signal: new AbortController().signal });
    return TranscriptDoc.parse({ version: 1, ...t });
  });
  await writeFile(transcriptFile, JSON.stringify(doc));
}

const cuts = await time("cut", async () => planCuts(doc.words, doc.durationS));
const keptS = doc.durationS - removedSeconds(cuts);
const llm = anthropic({ apiKey: env.ANTHROPIC_API_KEY, ...(env.ANTHROPIC_MODEL ? { model: env.ANTHROPIC_MODEL } : {}) });
const u = await time("understand", () => runUnderstand(llm, show, doc, cuts));
const w = await time("write", () => runWrite(llm, { ...show, voiceLessons: [] }, u.understanding, cuts, keptS));

const scores = score(w.output, approved);
const at = new Date().toISOString();
const line = { at, model: llm.model, scores, timings, pence: u.costPence + w.costPence, cuts: cuts.length, removedS: removedSeconds(cuts), droppedMoments: u.dropped };
await mkdir(join(dir, "runs"), { recursive: true });
await writeFile(join(dir, "runs", `${at.replace(/[:.]/g, "-")}.json`), JSON.stringify({ ...line, understanding: u.understanding, draft: w.output, cutList: cuts }, null, 2));
await appendFile(join(dir, "scores.jsonl"), `${JSON.stringify(line)}\n`);
console.log(JSON.stringify(line, null, 2));
