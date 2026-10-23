/**
 * Is the build plan actually done, or does it only say so?
 *
 *   npm run check:plan
 *
 * Reads docs/build/plan.json and proves each item against the repo and the live
 * database. Two kinds of answer matter:
 *
 *   REGRESSED — marked done, but a check no longer passes. Something was undone.
 *   FINISHED  — not marked done, but every check passes. Work landed and the
 *               plan was not updated; mark it done so the record stays honest.
 *
 * Database checks need DATABASE_URL or SUPABASE_DB_PASSWORD. Without one they
 * are reported as skipped, never as passed: a check that could not run must
 * never look like one that did.
 */
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";
import { databaseConnection } from "../src/db/connect";

type Check =
  | { kind: "file"; path: string }
  | { kind: "contains"; path: string; text: string }
  | { kind: "migration"; name: string }
  | { kind: "table"; name: string }
  | { kind: "function"; schema: string; name: string }
  | { kind: "jobs-succeeded"; step: string };

type Item = { id: string; phase: number; title: string; done: boolean; checks: Check[] };
type Outcome = "passed" | "failed" | "skipped";

const ROOT = new URL("../../../", import.meta.url).pathname;
const PLAN = join(ROOT, "docs/build/plan.json");

const { items } = JSON.parse(await readFile(PLAN, "utf8")) as { items: Item[] };

const connection = databaseConnection(process.env);
const sql = "error" in connection ? null : postgres(connection.url, { max: 1, prepare: false, idle_timeout: 10, connect_timeout: 15 });
if (!sql) console.log("note: no database settings, so database checks are skipped (not passed).\n");

async function run(check: Check): Promise<{ state: Outcome; detail: string }> {
  switch (check.kind) {
    case "file":
      return (await exists(join(ROOT, check.path)))
        ? { state: "passed", detail: check.path }
        : { state: "failed", detail: `${check.path} is not there` };
    case "contains": {
      const body = await readFile(join(ROOT, check.path), "utf8").catch(() => null);
      if (body === null) return { state: "failed", detail: `${check.path} is not there` };
      return body.includes(check.text)
        ? { state: "passed", detail: `${check.path} mentions ${check.text}` }
        : { state: "failed", detail: `${check.path} does not mention ${check.text}` };
    }
    case "migration":
      return ask(
        `migration ${check.name}`,
        async (db) => {
          const [row] = await db<{ n: number }[]>`
            select count(*)::int as n from supabase_migrations.schema_migrations where name = ${check.name}`;
          return (row?.n ?? 0) > 0;
        },
        `${check.name} is written but not applied`,
      );
    case "table":
      return ask(
        `table ${check.name}`,
        async (db) => {
          const [row] = await db<{ n: number }[]>`
            select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relname = ${check.name} and c.relkind = 'r' and c.relrowsecurity`;
          return (row?.n ?? 0) > 0;
        },
        `public.${check.name} is missing, or has no row level security`,
      );
    case "function":
      return ask(
        `function ${check.schema}.${check.name}`,
        async (db) => {
          const [row] = await db<{ n: number }[]>`
            select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = ${check.schema} and p.proname = ${check.name}`;
          return (row?.n ?? 0) > 0;
        },
        `${check.schema}.${check.name} is missing`,
      );
    case "jobs-succeeded":
      return ask(
        `${check.step} has run`,
        async (db) => {
          const [row] = await db<{ n: number }[]>`
            select count(*)::int as n from public.jobs where step = ${check.step} and status = 'succeeded'`;
          return (row?.n ?? 0) > 0;
        },
        `no ${check.step} job has ever succeeded`,
      );
  }
}

async function ask(name: string, query: (db: NonNullable<typeof sql>) => Promise<boolean>, whenFalse: string) {
  if (!sql) return { state: "skipped" as const, detail: `${name} — needs a database connection` };
  try {
    return (await query(sql)) ? { state: "passed" as const, detail: name } : { state: "failed" as const, detail: whenFalse };
  } catch (error) {
    return { state: "failed" as const, detail: `${name} — ${error instanceof Error ? error.message.split("\n")[0] : String(error)}` };
  }
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

const regressed: Item[] = [];
const finished: Item[] = [];
let lastPhase: number | null = null;

try {
  for (const item of [...items].sort((a, b) => a.phase - b.phase)) {
    const results = await Promise.all(item.checks.map(run));
    const failures = results.filter((r) => r.state === "failed");
    const skipped = results.filter((r) => r.state === "skipped");
    const allPassed = failures.length === 0 && skipped.length === 0;

    if (item.phase !== lastPhase) {
      console.log(`${lastPhase === null ? "" : "\n"}${item.phase === 0 ? "Alongside" : `Phase ${item.phase}`}`);
      lastPhase = item.phase;
    }

    let mark = "....";
    if (item.done && failures.length > 0) {
      mark = "REGR";
      regressed.push(item);
    } else if (item.done) {
      mark = "done";
    } else if (allPassed) {
      mark = "NEW ";
      finished.push(item);
    }

    console.log(`  ${mark}  ${item.title}`);
    for (const failure of failures) console.log(`        ${item.done ? "!" : "-"} ${failure.detail}`);
    for (const skip of skipped) console.log(`        ? ${skip.detail}`);
  }
} finally {
  await sql?.end({ timeout: 5 });
}

const done = items.filter((i) => i.done).length;
console.log(`\n${done} of ${items.length} done.`);
if (finished.length > 0) {
  console.log(`\n${finished.length} item(s) pass every check but are not marked done in docs/build/plan.json:`);
  for (const item of finished) console.log(`  ${item.id} — ${item.title}`);
}
if (regressed.length > 0) {
  console.log(`\n${regressed.length} item(s) marked done no longer pass:`);
  for (const item of regressed) console.log(`  ${item.id} — ${item.title}`);
}
process.exit(regressed.length > 0 ? 1 : 0);
