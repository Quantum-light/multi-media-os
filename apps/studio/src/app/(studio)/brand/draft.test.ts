import { describe, expect, it } from "vitest";
import { BrandKit } from "@mmos/contracts";
import { emptyBrandDraft, fromBrandKit, toBrandKit, unconfirmedUploads } from "./draft";

const kit = BrandKit.parse({
  version: 2,
  story: "The human side of Quantum Light Science.",
  styleWords: ["regal", "warm"],
  fonts: {
    display: { family: "Instrument Serif", source: "google", licenceConfirmed: false },
    base: { family: "Satoshi", source: "upload", licenceConfirmed: true },
  },
  colours: { ground: "#F1F2F4", accent: "#C9A24A", ink: "#2E3442", extra: ["#E6C978"] },
  motion: "thread",
  neverDo: ["never black"],
  personas: [{ name: "The curious commuter", description: "Listens on the way to work", evidence: [{ kind: "comment", note: "asked for shorter episodes" }] }],
});

describe("the brand kit draft", () => {
  it("survives a round trip through the editor unchanged", () => {
    const back = BrandKit.parse(toBrandKit(fromBrandKit(kit)));
    expect(back).toEqual(kit);
  });

  it("keeps personas and their evidence, which this screen does not edit", () => {
    const back = BrandKit.parse(toBrandKit(fromBrandKit(kit)));
    expect(back.personas[0]?.evidence).toHaveLength(1);
  });

  it("shows one empty row for a list a person has not filled in yet", () => {
    const bare = fromBrandKit(BrandKit.parse({ ...kit, styleWords: [], neverDo: [] }));
    expect(bare.styleWords).toEqual([""]);
    expect(bare.neverDo).toEqual([""]);
  });

  it("drops blank and whitespace-only rows on the way out", () => {
    const draft = { ...fromBrandKit(kit), styleWords: ["regal", "  ", ""], neverDo: [""] };
    const out = toBrandKit(draft) as { styleWords: string[]; neverDo: string[] };
    expect(out.styleWords).toEqual(["regal"]);
    expect(out.neverDo).toEqual([]);
  });

  it("stores a colour one way only", () => {
    const draft = { ...fromBrandKit(kit), accent: " #c9a24a " };
    const out = toBrandKit(draft) as { colours: { accent: string } };
    expect(out.colours.accent).toBe("#C9A24A");
  });

  it("leaves a half-typed colour alone so the contract can complain about it", () => {
    const draft = { ...fromBrandKit(kit), accent: "#c9a2" };
    const out = toBrandKit(draft) as { colours: { accent: string } };
    expect(out.colours.accent).toBe("#c9a2");
    expect(BrandKit.safeParse(out).success).toBe(false);
  });

  it("starts from the Studio's own palette rather than from nothing", () => {
    const blank = emptyBrandDraft();
    expect(blank.ground).toBe("#F1F2F4");
    expect(blank.motion).toBe("thread");
  });

  it("names an uploaded font whose licence has not been confirmed", () => {
    const draft = { ...fromBrandKit(kit), baseLicenceConfirmed: false };
    expect(unconfirmedUploads(draft)).toEqual(["Satoshi"]);
    expect(unconfirmedUploads(fromBrandKit(kit))).toEqual([]);
  });
});
