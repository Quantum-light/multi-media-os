import { describe, expect, it } from "vitest";
import { StyleDoc } from "@mmos/contracts";
import type { StyleCard } from "@/lib/data";
import { emptyStyleDraft, fromStyleCard, rename, reslug, toStyleDoc } from "./draft";

const card: StyleCard = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "how-i-open-an-episode",
  name: "How I open an episode",
  kind: "video",
  prompt: "Hold on my face for two beats before the first cut.",
  neverDo: ["music before I speak"],
  recipe: {
    version: 1,
    useWhen: "The first twenty seconds of a full episode.",
    palette: ["#C9A24A"],
    references: [],
    aspect: "16:9",
    captions: { on: true, position: "bottom" },
  },
  brandSlug: "quantum-light-science",
  archived: false,
};

describe("the style draft", () => {
  it("survives a round trip through the editor", () => {
    const back = StyleDoc.parse(toStyleDoc(fromStyleCard(card)));
    expect(back.slug).toBe(card.slug);
    expect(back.prompt).toBe(card.prompt);
    expect(back.recipe.aspect).toBe("16:9");
    expect(back.recipe.captions).toEqual({ on: true, position: "bottom" });
    expect(back.recipe.useWhen).toContain("twenty seconds");
  });

  it("leaves unset settings out entirely rather than guessing them", () => {
    const draft = { ...emptyStyleDraft(), slug: "bare", name: "Bare", prompt: "Just words." };
    const out = toStyleDoc(draft) as { recipe: Record<string, unknown> };
    expect("aspect" in out.recipe).toBe(false);
    expect("pace" in out.recipe).toBe(false);
    expect("captions" in out.recipe).toBe(false);
    expect(StyleDoc.safeParse(toStyleDoc(draft)).success).toBe(true);
  });

  it("keeps captions off as a real answer, not a missing one", () => {
    const draft = { ...emptyStyleDraft(), slug: "plain-cut", name: "Plain cut", prompt: "No captions at all.", captions: "off" as const };
    const parsed = StyleDoc.parse(toStyleDoc(draft));
    expect(parsed.recipe.captions).toEqual({ on: false, position: "bottom" });
  });

  it("follows the name with the slug until someone sets the slug by hand", () => {
    const named = rename(emptyStyleDraft(), "Warm Film");
    expect(named.slug).toBe("warm-film");

    const chosen = reslug(named, "my-warm-look");
    expect(rename(chosen, "Something Else").slug).toBe("my-warm-look");
  });

  it("never rewrites a slug when editing an existing style", () => {
    const draft = fromStyleCard(card);
    expect(rename(draft, "A new name").slug).toBe(card.slug);
  });

  it("drops blank rows and stores colours one way only", () => {
    const draft = { ...fromStyleCard(card), neverDo: ["", "  ", "stock footage"], palette: [" #c9a24a ".trim(), ""] };
    const parsed = StyleDoc.parse(toStyleDoc(draft));
    expect(parsed.neverDo).toEqual(["stock footage"]);
    expect(parsed.recipe.palette).toEqual(["#C9A24A"]);
  });

  it("falls back to a video style when the stored kind is not one we know", () => {
    expect(fromStyleCard({ ...card, kind: "hologram" }).kind).toBe("video");
  });

  it("offers one empty row for a never-do list that is empty", () => {
    expect(fromStyleCard({ ...card, neverDo: [] }).neverDo).toEqual([""]);
  });
});
