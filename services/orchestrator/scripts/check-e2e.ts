/**
 * The end-to-end check: does the whole system still work, not just the parts?
 *
 *   npm run check:e2e
 *
 * Three questions, in order of how much they matter:
 *   1. Do the database's own rules still hold? Every suite in packages/db/tests runs inside a
 *      transaction that always rolls back, so this is safe against the live project.
 *   2. Is the Studio serving, and still refusing to show a signed-out visitor anything?
 *   3. Is a worker alive and claiming work?
 *
 * Needs DATABASE_URL for 1 and 3. Without it those are reported as skipped, not passed:
 * a check that cannot run must never look like one that passed.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

type Check = { name: string; state: "passed" | "failed" | "skipped"; detail?: string };

const STUDIO = process.env.STUDIO_URL ?? "https://multi-media-os-studio.vercel.app";
const TESTS = new URL("../../../packages/db/tests", import.meta.url).pathname;
const WORKER_QUIET_MINUTES = Number(process.env.WORKER_QUIET_MINUTES ?? 15);

async function sqlSuites(databaseUrl: string): Promise<Check[]> {
  const sql = postgres(databaseUrl, { max: 1, prepare: false, idle_timeout: 10 });
  const checks: Check[] = [];
  try {
    const files = (await readdir(TESTS)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const body = await readFile(join(TESTS, file), "utf8");
      try {
        // Each suite is many statements in one transaction, so it must run in simple mode.
        await sql.unsafe(body).simple();
        checks.push({ name: `database rules · ${file}`, state: "passed" });
      } catch (error) {
        checks.push({ name: `database rules · ${file}`, state: "failed", detail: message(error) });
      }
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
  return checks;
}

async function workerAlive(databaseUrl: string): Promise<Check> {
  const sql = postgres(databaseUrl, { max: 1, prepare: false, idle_timeout: 10 });
  try {
    const [row] = await sql<{ claimed: Date | null; waiting: number }[]>`
      select
        (select max(at) from public.job_events where note like 'claimed by %' or note like 'reclaimed by %') as claimed,
        (select count(*) from public.jobs where status = 'queued' and run_after <= now()) as waiting`;
    const waiting = Number(row?.waiting ?? 0);
    const claimed = row?.claimed ?? null;
    if (waiting === 0 && !claimed) return { name: "worker", state: "skipped", detail: "nothing has ever been queued, so there is nothing to prove" };
    if (waiting > 0 && (!claimed || minutesSince(claimed) > WORKER_QUIET_MINUTES)) {
      return { name: "worker", state: "failed", detail: `${waiting} job(s) waiting and nothing claimed for ${claimed ? `${Math.round(minutesSince(claimed))} minutes` : "ever"}` };
    }
    return { name: "worker", state: "passed", detail: claimed ? `last claimed ${Math.round(minutesSince(claimed))} minutes ago` : "queue empty" };
  } catch (error) {
    return { name: "worker", state: "failed", detail: message(error) };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function studioServing(): Promise<Check[]> {
  const expect = async (path: string, want: number, name: string): Promise<Check> => {
    try {
      const res = await fetch(`${STUDIO}${path}`, { redirect: "manual" });
      return res.status === want
        ? { name, state: "passed" }
        : { name, state: "failed", detail: `${path} answered ${res.status}, expected ${want}` };
    } catch (error) {
      return { name, state: "failed", detail: message(error) };
    }
  };
  return Promise.all([
    expect("/login", 200, "Studio · sign-in page serves"),
    expect("/", 307, "Studio · a signed-out visitor is sent to sign in"),
    expect("/vision", 307, "Studio · pages are not readable signed out"),
  ]);
}

function minutesSince(at: Date): number {
  return (Date.now() - at.getTime()) / 60_000;
}
function message(error: unknown): string {
  return error instanceof Error ? error.message.split("\n")[0] ?? error.message : String(error);
}

const databaseUrl = process.env.DATABASE_URL;
const checks: Check[] = [
  ...(databaseUrl ? await sqlSuites(databaseUrl) : [{ name: "database rules", state: "skipped" as const, detail: "DATABASE_URL is not set" }]),
  ...(await studioServing()),
  ...(databaseUrl ? [await workerAlive(databaseUrl)] : [{ name: "worker", state: "skipped" as const, detail: "DATABASE_URL is not set" }]),
];

const mark = { passed: "ok  ", failed: "FAIL", skipped: "skip" } as const;
for (const c of checks) console.log(`${mark[c.state]}  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);

const failed = checks.filter((c) => c.state === "failed");
const skipped = checks.filter((c) => c.state === "skipped");
console.log(`\n${checks.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped.`);
process.exit(failed.length > 0 ? 1 : 0);
