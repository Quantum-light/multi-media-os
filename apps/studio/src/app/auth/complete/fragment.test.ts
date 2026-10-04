import { describe, expect, it } from "vitest";
import { readAuthFragment } from "./fragment";

describe("readAuthFragment", () => {
  it("reads a session", () => {
    expect(readAuthFragment("#access_token=a.b.c&expires_in=3600&refresh_token=r1&token_type=bearer&type=magiclink")).toEqual({ kind: "session", accessToken: "a.b.c", refreshToken: "r1" });
  });
  it("explains an expired or used link", () => {
    const r = readAuthFragment("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    expect(r).toMatchObject({ kind: "error", message: expect.stringMatching(/expired or was already used/) });
  });
  it("treats anything else as nothing to use", () => {
    expect(readAuthFragment("")).toEqual({ kind: "none" });
    expect(readAuthFragment("#access_token=only")).toEqual({ kind: "none" });
  });
});
