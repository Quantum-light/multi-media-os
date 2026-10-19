import { describe, expect, it } from "vitest";
import { z } from "zod";
import { problemsFrom, slugify } from "./save";

const schema = z.object({
  name: z.string().min(1),
  words: z.array(z.string().min(1)).max(2),
  pillars: z.array(z.object({ title: z.string().min(1) })),
});

function issues(value: unknown) {
  const result = schema.safeParse(value);
  if (result.success) throw new Error("expected this to fail");
  return result.error.issues;
}

describe("problemsFrom", () => {
  const labels = { name: "The name", words: "Style words", title: "Pillar" };

  it("says which field is empty, in the screen's own words", () => {
    const problems = problemsFrom(issues({ words: [], pillars: [] }), labels);
    expect(problems).toEqual(["The name is still empty."]);
  });

  it("counts the position inside a list when asked to", () => {
    const value = { name: "x", words: [], pillars: [{ title: "ok" }, { title: "" }] };
    const problems = problemsFrom(issues(value), labels, ["pillars"]);
    expect(problems).toEqual(["Pillar (second pillar) needs something in it."]);
  });

  it("leaves the position out when the list is not worth counting", () => {
    const value = { name: "x", words: [], pillars: [{ title: "" }] };
    expect(problemsFrom(issues(value), labels)).toEqual(["Pillar needs something in it."]);
  });

  it("says when there are too many", () => {
    const value = { name: "x", words: ["a", "b", "c"], pillars: [] };
    expect(problemsFrom(issues(value), labels)).toEqual(["Style words has too many."]);
  });

  it("never repeats itself, and stops at the limit", () => {
    const value = { name: "", words: [], pillars: [{ title: "" }, { title: "" }] };
    const problems = problemsFrom(issues(value), labels, [], 2);
    expect(problems).toHaveLength(2);
    expect(new Set(problems).size).toBe(2);
  });
});

describe("slugify", () => {
  it("makes a usable slug from what a person types", () => {
    expect(slugify("How I open an episode")).toBe("how-i-open-an-episode");
    expect(slugify("  Warm Film!  ")).toBe("warm-film");
    expect(slugify("Café / Soirée")).toBe("cafe-soiree");
  });

  it("never ends on a dash, even when it has to cut the text short", () => {
    const long = slugify("a".repeat(58) + " bb");
    expect(long.endsWith("-")).toBe(false);
    expect(long.length).toBeLessThanOrEqual(60);
  });

  it("gives back nothing when there is nothing usable", () => {
    expect(slugify("!!!")).toBe("");
  });
});
