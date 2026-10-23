/**
 * Answers one question: does this password actually open the database?
 *
 * Run it with a file holding the password and nothing else:
 *
 *   npx tsx services/orchestrator/scripts/check-db.ts ~/.mmos-dbpw
 *
 * It builds the address exactly as the worker does, connects, and says PASS or
 * FAIL with the reason. The password is never printed, logged or echoed — only
 * its length, so a stray newline or a truncated copy can be spotted.
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { databaseConnection } from "../src/db/connect";

const file = process.argv[2];
if (!file) {
  console.error("Give me the file holding the password: npx tsx services/orchestrator/scripts/check-db.ts ~/.mmos-dbpw");
  process.exit(2);
}

const raw = readFileSync(file.replace(/^~/, process.env["HOME"] ?? "~"), "utf8");
const password = raw.trim();

console.log(`password: ${password.length} characters${raw.endsWith("\n") ? " (a trailing newline was trimmed)" : ""}`);
if (password === "") {
  console.error("FAIL: that file is empty.");
  process.exit(1);
}

const ref = process.env["SUPABASE_PROJECT_REF"] ?? "rxweinpsmtgrostfoutn";
const connection = databaseConnection({ SUPABASE_DB_PASSWORD: password, SUPABASE_PROJECT_REF: ref });
if ("error" in connection) {
  console.error(`FAIL: ${connection.error}`);
  process.exit(1);
}
console.log(`connecting as: ${connection.describe}`);

const sql = postgres(connection.url, { max: 1, prepare: false, idle_timeout: 5, connect_timeout: 15 });
try {
  const [row] = await sql<{ who: string; db: string }[]>`select current_user as who, current_database() as db`;
  console.log(`PASS: connected as ${row?.who} to ${row?.db}`);
  console.log("So the password is right and the pooler accepts it. Anything still failing is the Railway settings, not Supabase.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL: ${message}`);
  if (/password authentication failed/i.test(message)) {
    console.error("The pooler rejected this exact password. Reset it in Supabase and try this again before touching Railway.");
  }
  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED/i.test(message)) {
    console.error("That is a network problem, not a password one: the pooler host could not be reached from here.");
  }
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
