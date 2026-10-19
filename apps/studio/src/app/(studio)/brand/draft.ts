import type { BrandKit } from "@mmos/contracts";

type FontSource = "google" | "upload";
type Motion = "thread" | "frame" | "pulse";

/**
 * The brand kit while a person is editing it. Everything is a string or a list
 * of strings, so a half-typed colour or an empty row never snaps back.
 */
export type BrandDraft = {
  story: string;
  styleWords: string[];
  displayFamily: string;
  displaySource: FontSource;
  displayLicenceConfirmed: boolean;
  baseFamily: string;
  baseSource: FontSource;
  baseLicenceConfirmed: boolean;
  ground: string;
  accent: string;
  ink: string;
  extra: string[];
  motion: Motion;
  neverDo: string[];
  /** Carried through untouched: personas need their evidence, which this screen does not edit. */
  personas: BrandKit["personas"];
  version: number;
};

export function emptyBrandDraft(): BrandDraft {
  return {
    story: "",
    styleWords: [""],
    displayFamily: "",
    displaySource: "google",
    displayLicenceConfirmed: false,
    baseFamily: "",
    baseSource: "google",
    baseLicenceConfirmed: false,
    ground: "#F1F2F4",
    accent: "#C9A24A",
    ink: "#2E3442",
    extra: [],
    motion: "thread",
    neverDo: [""],
    personas: [],
    version: 1,
  };
}

export function fromBrandKit(kit: BrandKit): BrandDraft {
  return {
    story: kit.story,
    styleWords: kit.styleWords.length > 0 ? [...kit.styleWords] : [""],
    displayFamily: kit.fonts.display.family,
    displaySource: kit.fonts.display.source,
    displayLicenceConfirmed: kit.fonts.display.licenceConfirmed,
    baseFamily: kit.fonts.base.family,
    baseSource: kit.fonts.base.source,
    baseLicenceConfirmed: kit.fonts.base.licenceConfirmed,
    ground: kit.colours.ground,
    accent: kit.colours.accent,
    ink: kit.colours.ink,
    extra: [...kit.colours.extra],
    motion: kit.motion,
    neverDo: kit.neverDo.length > 0 ? [...kit.neverDo] : [""],
    personas: kit.personas,
    version: kit.version,
  };
}

/**
 * The shape the contract checks. Blank rows are dropped, text is trimmed, and
 * colours are upper-cased so the same colour is never stored two ways.
 */
export function toBrandKit(draft: BrandDraft): unknown {
  return {
    version: draft.version,
    story: draft.story.trim(),
    styleWords: words(draft.styleWords),
    fonts: {
      display: { family: draft.displayFamily.trim(), source: draft.displaySource, licenceConfirmed: draft.displayLicenceConfirmed },
      base: { family: draft.baseFamily.trim(), source: draft.baseSource, licenceConfirmed: draft.baseLicenceConfirmed },
    },
    colours: {
      ground: colour(draft.ground),
      accent: colour(draft.accent),
      ink: colour(draft.ink),
      extra: words(draft.extra).map(colour),
    },
    motion: draft.motion,
    neverDo: words(draft.neverDo),
    personas: draft.personas,
  };
}

/**
 * An uploaded font needs the creator's word that they hold the licence; a Google
 * font does not. Said here rather than in the contract so the screen can nudge
 * before a save is attempted.
 */
export function unconfirmedUploads(draft: BrandDraft): string[] {
  const rows: { family: string; source: FontSource; confirmed: boolean }[] = [
    { family: draft.displayFamily, source: draft.displaySource, confirmed: draft.displayLicenceConfirmed },
    { family: draft.baseFamily, source: draft.baseSource, confirmed: draft.baseLicenceConfirmed },
  ];
  return rows.filter((row) => row.source === "upload" && !row.confirmed).map((row) => row.family.trim() || "An uploaded font");
}

function words(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value !== "");
}

function colour(value: string): string {
  const text = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(text) ? text.toUpperCase() : text;
}
