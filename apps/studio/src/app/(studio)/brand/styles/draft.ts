import type { StyleCard } from "@/lib/data";
import { slugify } from "@/lib/save";

type Kind = "video" | "image" | "motion" | "voice";
type Aspect = "16:9" | "9:16" | "1:1" | "4:5";
type Pace = "slow" | "steady" | "quick";
type CaptionPosition = "top" | "middle" | "bottom";

/**
 * A style while it is being written. The optional recipe settings are "" when
 * unset, because a style is allowed to be nothing but a good instruction.
 */
export type StyleDraft = {
  slug: string;
  /** False until a person edits the slug by hand; until then it follows the name. */
  slugEdited: boolean;
  name: string;
  kind: Kind;
  useWhen: string;
  prompt: string;
  neverDo: string[];
  palette: string[];
  aspect: Aspect | "";
  pace: Pace | "";
  captions: "on" | "off" | "";
  captionPosition: CaptionPosition;
  brandSlug: string;
  version: number;
};

export function emptyStyleDraft(brandSlug = ""): StyleDraft {
  return {
    slug: "",
    slugEdited: false,
    name: "",
    kind: "video",
    useWhen: "",
    prompt: "",
    neverDo: [""],
    palette: [],
    aspect: "",
    pace: "",
    captions: "",
    captionPosition: "bottom",
    brandSlug,
    version: 1,
  };
}

export function fromStyleCard(card: StyleCard): StyleDraft {
  const recipe = card.recipe;
  const captions = recipe?.captions;
  return {
    slug: card.slug,
    slugEdited: true,
    name: card.name,
    kind: asKind(card.kind),
    useWhen: recipe?.useWhen ?? "",
    prompt: card.prompt,
    neverDo: card.neverDo.length > 0 ? [...card.neverDo] : [""],
    palette: recipe ? [...recipe.palette] : [],
    aspect: recipe?.aspect ?? "",
    pace: recipe?.pace ?? "",
    captions: captions === undefined ? "" : captions.on ? "on" : "off",
    captionPosition: captions?.position ?? "bottom",
    brandSlug: card.brandSlug ?? "",
    version: recipe?.version ?? 1,
  };
}

/** Renaming a style renames its slug too, until someone sets the slug themselves. */
export function rename(draft: StyleDraft, name: string): StyleDraft {
  return { ...draft, name, slug: draft.slugEdited ? draft.slug : slugify(name) };
}

export function reslug(draft: StyleDraft, slug: string): StyleDraft {
  return { ...draft, slug, slugEdited: true };
}

/** The shape the contract checks. Unset settings are left out rather than guessed. */
export function toStyleDoc(draft: StyleDraft): unknown {
  const recipe: Record<string, unknown> = {
    version: draft.version,
    useWhen: draft.useWhen.trim(),
    palette: words(draft.palette).map(colour),
    references: [],
  };
  if (draft.aspect !== "") recipe["aspect"] = draft.aspect;
  if (draft.pace !== "") recipe["pace"] = draft.pace;
  if (draft.captions !== "") recipe["captions"] = { on: draft.captions === "on", position: draft.captionPosition };

  return {
    slug: draft.slug.trim(),
    name: draft.name.trim(),
    kind: draft.kind,
    prompt: draft.prompt.trim(),
    neverDo: words(draft.neverDo),
    recipe,
  };
}

function asKind(value: string): Kind {
  return value === "image" || value === "motion" || value === "voice" ? value : "video";
}

function words(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value !== "");
}

function colour(value: string): string {
  return /^#[0-9A-Fa-f]{6}$/.test(value) ? value.toUpperCase() : value;
}
