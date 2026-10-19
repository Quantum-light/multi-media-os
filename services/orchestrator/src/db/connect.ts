/**
 * Where the worker's database address comes from.
 *
 * `DATABASE_URL` carries the host, port, user and password in one line. A
 * password holding `#`, `?`, `/`, `@` or a space quietly breaks that line, and
 * so does a newline picked up while copying — and none of it is visible by
 * looking at the setting. That one string has cost this build days.
 *
 * So the worker prefers the password on its own:
 *
 *   SUPABASE_DB_PASSWORD   the password, symbols and all, nothing else
 *
 * and builds the rest itself. It takes the host, port and user from
 * `DATABASE_URL` when that is set, so nothing has to be guessed; otherwise it
 * builds the Session pooler address from `SUPABASE_PROJECT_REF`.
 *
 * `DATABASE_URL` on its own still works, so moving the settings over can happen
 * in either order without the worker going down in between.
 */

export type Connection = {
  /** Never logged, never printed. */
  url: string;
  /** Safe to log: no password, not even its length. */
  describe: string;
  /** Things worth saying out loud once at startup. */
  warnings: string[];
};

export type ConnectionProblem = { error: string };

type Env = Record<string, string | undefined>;

const POOLER_PORT = "5432";
const DEFAULT_REGION = "eu-west-1";

/** Characters that break a password when it is pasted into a URL unencoded. */
const NEEDS_ENCODING = /[^A-Za-z0-9._~-]/;

export function databaseConnection(env: Env): Connection | ConnectionProblem {
  const password = clean(env["SUPABASE_DB_PASSWORD"]);
  const url = clean(env["DATABASE_URL"]);

  if (password !== "") return fromPassword(password, url, env);
  if (url !== "") return fromUrl(url);

  return {
    error:
      "The worker has no way to reach the database. Set SUPABASE_DB_PASSWORD in Railway to the database password on its own (preferred), or DATABASE_URL to the full Supabase pooler connection string.",
  };
}

/** The good path: the password on its own, encoded by us rather than by hand. */
function fromPassword(password: string, url: string, env: Env): Connection | ConnectionProblem {
  const warnings: string[] = [];
  const parts = url === "" ? null : addressOf(url);

  if (url !== "" && parts === null) {
    warnings.push("DATABASE_URL could not be read, so the address was built from SUPABASE_PROJECT_REF instead. It can be deleted.");
  } else if (parts !== null) {
    warnings.push("DATABASE_URL is still set. Only its host and user are used now; its password is ignored and it can be deleted.");
  }

  const address = parts ?? poolerAddress(env);
  if ("error" in address) return address;

  return {
    url: `postgresql://${address.user}:${encodeURIComponent(password)}@${address.hostAndRest}`,
    describe: `${address.user}@${address.hostAndRest} (password set separately)`,
    warnings,
  };
}

/** The old path: one long string, used exactly as given. */
function fromUrl(url: string): Connection {
  const warnings = [
    "Using DATABASE_URL. Set SUPABASE_DB_PASSWORD to the password on its own instead: symbols and stray spaces then stop mattering.",
  ];
  const address = addressOf(url);
  const secret = passwordIn(url);

  if (secret !== null && NEEDS_ENCODING.test(secret)) {
    warnings.push(
      "The password inside DATABASE_URL contains a character that has to be percent-encoded. If the database refuses it, that is why — move it to SUPABASE_DB_PASSWORD.",
    );
  }

  return {
    url,
    describe: address === null ? "DATABASE_URL (unrecognised shape)" : `${address.user}@${address.hostAndRest}`,
    warnings,
  };
}

type Address = { user: string; hostAndRest: string };

/**
 * Splits a connection string on its LAST `@`, so an unencoded `@` inside the
 * password does not move the host.
 */
export function addressOf(url: string): Address | null {
  const body = url.replace(/^postgres(ql)?:\/\//, "");
  const at = body.lastIndexOf("@");
  if (at <= 0) return null;

  const credentials = body.slice(0, at);
  const hostAndRest = body.slice(at + 1);
  if (hostAndRest === "" || !hostAndRest.includes(".")) return null;

  const colon = credentials.indexOf(":");
  const user = colon === -1 ? credentials : credentials.slice(0, colon);
  return user === "" ? null : { user, hostAndRest };
}

/** The password as written in a connection string, for checking — never for logging. */
function passwordIn(url: string): string | null {
  const body = url.replace(/^postgres(ql)?:\/\//, "");
  const at = body.lastIndexOf("@");
  if (at <= 0) return null;
  const credentials = body.slice(0, at);
  const colon = credentials.indexOf(":");
  return colon === -1 ? null : credentials.slice(colon + 1);
}

/** Supabase's Session pooler, which answers on IPv4. The direct host does not. */
function poolerAddress(env: Env): Address | ConnectionProblem {
  const ref = clean(env["SUPABASE_PROJECT_REF"]);
  if (ref === "") {
    return {
      error:
        "SUPABASE_DB_PASSWORD is set but the project is unknown. Add SUPABASE_PROJECT_REF (the Supabase project reference) so the worker can build the pooler address.",
    };
  }
  const host = clean(env["SUPABASE_POOLER_HOST"]) || `aws-0-${clean(env["SUPABASE_REGION"]) || DEFAULT_REGION}.pooler.supabase.com`;
  return { user: `postgres.${ref}`, hostAndRest: `${host}:${POOLER_PORT}/postgres` };
}

/**
 * Trims the spaces and line breaks that come along when a value is pasted, and
 * removes one pair of wrapping quotes. Only a matching pair is removed, so a
 * password that genuinely starts or ends with a quote survives.
 */
export function clean(value: string | undefined): string {
  if (value === undefined) return "";
  const trimmed = value.trim();
  const first = trimmed.charAt(0);
  const wrapped = trimmed.length > 1 && (first === '"' || first === "'") && trimmed.endsWith(first);
  return wrapped ? trimmed.slice(1, -1).trim() : trimmed;
}
