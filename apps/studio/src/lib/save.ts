import type { ZodIssue } from "zod";

/** What every "save" server action in the Studio answers with. */
export type SaveResult = { ok: true } | { ok: false; message: string; problems: string[] };

const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];

/**
 * Turns contract complaints into sentences a person can act on.
 *
 * `labels` maps a field name to the words the screen uses for it. `countWithin`
 * names list fields whose position is worth saying out loud ("second pillar"),
 * so a problem can be found without counting rows.
 */
export function problemsFrom(issues: ZodIssue[], labels: Record<string, string>, countWithin: string[] = [], limit = 6): string[] {
  const sentences = issues.map((issue) => {
    const names = issue.path.filter((part): part is string => typeof part === "string");
    const index = issue.path.find((part): part is number => typeof part === "number");
    const last = names.length > 0 ? names[names.length - 1]! : "";
    const field = labels[last] ?? (last === "" ? "Something" : last);
    const within = countWithin.find((name) => names.includes(name));
    const where = within !== undefined && index !== undefined ? ` (${ORDINALS[index] ?? `${index + 1}th`} ${singular(within)})` : "";
    if (issue.code === "invalid_type") return `${field}${where} is still empty.`;
    if (issue.code === "too_small") return `${field}${where} needs something in it.`;
    if (issue.code === "too_big") return `${field}${where} has too many.`;
    return `${field}${where}: ${lower(issue.message)}`;
  });
  return [...new Set(sentences)].slice(0, limit);
}

/** Lowercases the first letter only, so "#RRGGBB" and names keep their shape. */
function lower(message: string): string {
  return message.charAt(0).toLowerCase() + message.slice(1);
}

function singular(name: string): string {
  return name.endsWith("s") ? name.slice(0, -1) : name;
}

/** Lowercase, dash-separated, from anything a person types. */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}
