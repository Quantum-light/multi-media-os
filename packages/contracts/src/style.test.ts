import { describe, expect, it } from "vitest";
import { Slug, StyleDoc, StyleRecipe } from "./style";

const good = {
  slug: "how-i-open-an-episode",
  name: "How I open an episode",
  kind: "video" as const,
  prompt: "Hold on my face for two beats before the first cut. No music until I speak.",
  neverDo: ["stock footage"],
  recipe: { version: 1, useWhen: "The first twenty seconds of a full episode.", aspect: "16:9" as const, palette: ["#C9A24A"], references: [] },
};

describe("Slug", () => {
  it("accepts lowercase words joined by dashes", () => {
    expect(Slug.safeParse("warm-film").success).toBe(true);
  });

  it("refuses spaces, capitals and stray dashes", () => {
    for (const bad of ["warm film", "Warm-Film", "-warm", "warm-", "warm--film", "w"]) {
      expect(Slug.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe("StyleRecipe", () => {
  it("fills in its own defaults, so an empty recipe is still valid", () => {
    const parsed = StyleRecipe.parse({});
    expect(parsed).toMatchObject({ version: 1, useWhen: "", palette: [], references: [] });
  });

  it("refuses a colour that is not #RRGGBB", () => {
    expect(StyleRecipe.safeParse({ palette: ["gold"] }).success).toBe(false);
  });

  it("holds at most six colours", () => {
    const seven = ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777"];
    expect(StyleRecipe.safeParse({ palette: seven }).success).toBe(false);
  });
});

describe("StyleDoc", () => {
  it("accepts a style a person would actually save", () => {
    expect(StyleDoc.safeParse(good).success).toBe(true);
  });

  it("insists on an instruction", () => {
    const result = StyleDoc.safeParse({ ...good, prompt: "" });
    expect(result.success).toBe(false);
  });

  it("insists on a name", () => {
    expect(StyleDoc.safeParse({ ...good, name: "" }).success).toBe(false);
  });

  it("refuses an unknown kind", () => {
    expect(StyleDoc.safeParse({ ...good, kind: "hologram" }).success).toBe(false);
  });

  it("treats the never-do list as optional", () => {
    const { neverDo, ...rest } = good;
    void neverDo;
    expect(StyleDoc.parse(rest).neverDo).toEqual([]);
  });

  it("keeps when-to-use-it with the recipe, so one read tells you both", () => {
    const parsed = StyleDoc.parse(good);
    expect(parsed.recipe.useWhen).toContain("twenty seconds");
  });
});
