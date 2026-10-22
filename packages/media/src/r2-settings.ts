/** The Cloudflare R2 settings both the Studio and the worker read. */
export type R2Settings = { endpoint: string; accessKeyId: string; secretAccessKey: string; bucket: string };

type Env = Record<string, string | undefined>;

const NAMES = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;

/**
 * Reads the R2 settings, forgiving what copying from a dashboard tends to add: spaces,
 * line breaks and surrounding quotes. A value that still holds characters no key can
 * contain is reported by name (never by value), instead of surfacing later as an
 * "Invalid character in header content" from deep inside the storage client.
 */
export function readR2Settings(env: Env): { ok: true; settings: R2Settings } | { ok: false; missing: boolean; problem: string } {
  const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["'](.*)["']$/s, "$1").trim();
  const values = Object.fromEntries(NAMES.map((n) => [n, clean(env[n])])) as Record<(typeof NAMES)[number], string>;

  const empty = NAMES.filter((n) => !values[n]);
  if (empty.length) return { ok: false, missing: true, problem: `Storage settings missing: ${empty.join(", ")}` };

  const bad = NAMES.filter((n) => !/^[\x21-\x7e]+$/.test(values[n]));
  if (bad.length) {
    return { ok: false, missing: false, problem: `${bad.join(" and ")} ${bad.length === 1 ? "has" : "have"} a space, line break or unusual character inside. Paste ${bad.length === 1 ? "it" : "them"} again from Cloudflare R2 → Manage API tokens.` };
  }

  const jurisdiction = clean(env.R2_JURISDICTION) === "eu" ? ".eu" : "";
  return {
    ok: true,
    settings: {
      endpoint: `https://${values.R2_ACCOUNT_ID}${jurisdiction}.r2.cloudflarestorage.com`,
      accessKeyId: values.R2_ACCESS_KEY_ID,
      secretAccessKey: values.R2_SECRET_ACCESS_KEY,
      bucket: values.R2_BUCKET,
    },
  };
}
