// Anti-clunk rule 2: no source file over 400 lines.
// Migrations (reviewed as one change) and generated database types are exempt; everything else is not.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const LIMIT = 400;
const ROOTS = ["apps", "packages", "services", "scripts"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".py"]);
const SKIP = new Set(["node_modules", ".next", "dist", ".turbo", "migrations", "database.types.ts"]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (EXTENSIONS.has(extname(name))) yield path;
  }
}

const offenders = [];
for (const root of ROOTS) {
  try {
    for (const file of walk(root)) {
      const lines = readFileSync(file, "utf8").split("\n").length;
      if (lines > LIMIT) offenders.push(`${file}: ${lines} lines`);
    }
  } catch {
    // a root that does not exist yet is fine
  }
}

if (offenders.length > 0) {
  console.error(`Files over ${LIMIT} lines (split them):\n  ${offenders.join("\n  ")}`);
  process.exit(1);
}
console.log(`File size check passed (limit ${LIMIT} lines).`);
