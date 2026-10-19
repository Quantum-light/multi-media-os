import { describe, expect, it } from "vitest";
import { addressOf, clean, databaseConnection } from "./connect";

const REF = "rxweinpsmtgrostfoutn";
const POOLER = `postgresql://postgres.${REF}:pw@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;

function ok(result: ReturnType<typeof databaseConnection>) {
  if ("error" in result) throw new Error(`expected a connection, got: ${result.error}`);
  return result;
}

describe("databaseConnection", () => {
  it("builds the address from the password alone, keeping the host from DATABASE_URL", () => {
    const result = ok(databaseConnection({ SUPABASE_DB_PASSWORD: "a#b?c/d@e f", DATABASE_URL: POOLER }));
    expect(result.url).toBe(`postgresql://postgres.${REF}:a%23b%3Fc%2Fd%40e%20f@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`);
  });

  it("encodes every character that would otherwise break the line", () => {
    const result = ok(databaseConnection({ SUPABASE_DB_PASSWORD: "p@ss:w/ord#?&=+ %", SUPABASE_PROJECT_REF: REF }));
    const password = result.url.slice(`postgresql://postgres.${REF}:`.length, result.url.lastIndexOf("@"));
    expect(decodeURIComponent(password)).toBe("p@ss:w/ord#?&=+ %");
    expect(password).not.toContain("@");
    expect(password).not.toContain(":");
  });

  it("builds the Session pooler address when there is no DATABASE_URL at all", () => {
    const result = ok(databaseConnection({ SUPABASE_DB_PASSWORD: "simple", SUPABASE_PROJECT_REF: REF }));
    expect(result.url).toBe(`postgresql://postgres.${REF}:simple@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`);
  });

  it("lets the pooler host and region be set, for a project in another region", () => {
    const west = ok(databaseConnection({ SUPABASE_DB_PASSWORD: "x", SUPABASE_PROJECT_REF: REF, SUPABASE_REGION: "us-east-1" }));
    expect(west.url).toContain("aws-0-us-east-1.pooler.supabase.com");

    const exact = ok(databaseConnection({ SUPABASE_DB_PASSWORD: "x", SUPABASE_PROJECT_REF: REF, SUPABASE_POOLER_HOST: "aws-1-eu-west-1.pooler.supabase.com" }));
    expect(exact.url).toContain("aws-1-eu-west-1.pooler.supabase.com");
  });

  it("says what is missing when the password is set but the project is not", () => {
    const result = databaseConnection({ SUPABASE_DB_PASSWORD: "x" });
    expect("error" in result && result.error).toContain("SUPABASE_PROJECT_REF");
  });

  it("still works with DATABASE_URL on its own, so nothing goes down mid-change", () => {
    const result = ok(databaseConnection({ DATABASE_URL: POOLER }));
    expect(result.url).toBe(POOLER);
  });

  it("says plainly when there is nothing to connect with", () => {
    const result = databaseConnection({});
    expect("error" in result && result.error).toContain("SUPABASE_DB_PASSWORD");
  });

  it("survives the ways a pasted value arrives: spaces, newlines, wrapping quotes", () => {
    const result = ok(databaseConnection({ SUPABASE_DB_PASSWORD: '  "simple"\n', SUPABASE_PROJECT_REF: ` ${REF}\n` }));
    expect(result.url).toBe(`postgresql://postgres.${REF}:simple@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`);
  });

  it("never puts the password anywhere it could be logged", () => {
    const result = ok(databaseConnection({ SUPABASE_DB_PASSWORD: "hunter2-secret", DATABASE_URL: POOLER }));
    expect(result.describe).not.toContain("hunter2");
    expect(result.warnings.join(" ")).not.toContain("hunter2");
    expect(result.describe).toContain(`postgres.${REF}@aws-0-eu-west-1.pooler.supabase.com`);
  });

  it("warns that DATABASE_URL is now ignored, so it gets deleted rather than trusted", () => {
    const result = ok(databaseConnection({ SUPABASE_DB_PASSWORD: "x", DATABASE_URL: POOLER }));
    expect(result.warnings.join(" ")).toContain("can be deleted");
  });

  it("warns about a password in DATABASE_URL that needs encoding — the fault that caused all this", () => {
    const risky = `postgresql://postgres.${REF}:a#b@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;
    const result = ok(databaseConnection({ DATABASE_URL: risky }));
    expect(result.warnings.join(" ")).toContain("percent-encoded");
  });

  it("does not cry wolf about a password that is already safe", () => {
    const result = ok(databaseConnection({ DATABASE_URL: POOLER }));
    expect(result.warnings.join(" ")).not.toContain("percent-encoded");
  });
});

describe("addressOf", () => {
  it("splits on the last @, so an unencoded @ in the password cannot move the host", () => {
    expect(addressOf(`postgresql://postgres.${REF}:pa@ss@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`)).toEqual({
      user: `postgres.${REF}`,
      hostAndRest: "aws-0-eu-west-1.pooler.supabase.com:5432/postgres",
    });
  });

  it("reads a string with no scheme, and one with postgres://", () => {
    expect(addressOf("postgres://u:p@host.example.com:5432/postgres")?.user).toBe("u");
    expect(addressOf("u:p@host.example.com:5432/postgres")?.user).toBe("u");
  });

  it("gives back nothing for a string that is not a connection string", () => {
    for (const bad of ["", "not-a-url", "postgresql://host.example.com/postgres", "@host.example.com", "u:p@localhost"]) {
      expect(addressOf(bad), bad).toBeNull();
    }
  });
});

describe("clean", () => {
  it("removes only a matching pair of quotes", () => {
    expect(clean('"secret"')).toBe("secret");
    expect(clean("'secret'")).toBe("secret");
    expect(clean('"secret')).toBe('"secret');
    expect(clean("secret\"")).toBe("secret\"");
  });

  it("keeps a password that genuinely ends in a quote", () => {
    expect(clean("pass'word")).toBe("pass'word");
  });

  it("treats a missing value as empty", () => {
    expect(clean(undefined)).toBe("");
  });
});
