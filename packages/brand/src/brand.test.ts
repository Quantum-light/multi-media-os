import { describe, expect, it } from "vitest";
import { BrandKit } from "@mmos/contracts";
import { humanTimeWithGG, journeysWithTime, studio } from "./index";

describe("QLS brand kits", () => {
  it.each([
    ["Journeys with Time", journeysWithTime],
    ["Human Time with GG", humanTimeWithGG],
  ])("%s is a valid brand kit", (_name, kit) => {
    expect(BrandKit.safeParse(kit).success).toBe(true);
  });

  it("both shows share the Cinzel and Satoshi pairing", () => {
    expect(journeysWithTime.fonts).toEqual(humanTimeWithGG.fonts);
  });
});

describe("studio tokens", () => {
  it("never uses black", () => {
    const values = JSON.stringify(studio).toLowerCase();
    expect(values).not.toMatch(/#000000|#000\b|rgb\(0, ?0, ?0\)/);
  });
});
