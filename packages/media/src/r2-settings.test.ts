import { describe, expect, it } from "vitest";
import { readR2Settings } from "./r2-settings";

const good = { R2_ACCOUNT_ID: "abc123", R2_ACCESS_KEY_ID: "a1b2c3", R2_SECRET_ACCESS_KEY: "s3cr3t", R2_BUCKET: "mmos-media" };

describe("R2 settings", () => {
  it("forgives line breaks, spaces and quotes picked up while copying", () => {
    const read = readR2Settings({ ...good, R2_ACCESS_KEY_ID: " a1b2c3\n", R2_SECRET_ACCESS_KEY: '"s3cr3t"\r\n', R2_JURISDICTION: "eu" });
    expect(read).toEqual({ ok: true, settings: { endpoint: "https://abc123.eu.r2.cloudflarestorage.com", accessKeyId: "a1b2c3", secretAccessKey: "s3cr3t", bucket: "mmos-media" } });
  });
  it("names a setting with a character no key can hold, without showing its value", () => {
    const read = readR2Settings({ ...good, R2_ACCESS_KEY_ID: "a1b2\nc3" });
    expect(read).toMatchObject({ ok: false, missing: false, problem: expect.stringContaining("R2_ACCESS_KEY_ID has") });
    expect(JSON.stringify(read)).not.toContain("a1b2");
  });
  it("lists what is missing", () => {
    expect(readR2Settings({ R2_BUCKET: "b" })).toMatchObject({ ok: false, missing: true, problem: "Storage settings missing: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY" });
  });
});
