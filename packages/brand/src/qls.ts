import type { BrandKit } from "@mmos/contracts";

/**
 * Quantum Light Science: workspace one. Cinzel is the regal display face,
 * Satoshi the everyday base. Each show has its own colour theme; gold is
 * always the thread.
 */
const shared = {
  story: "Science for everyday people, with a regal feel.",
  styleWords: ["regal but everyday", "calm", "luminous", "never sci-fi"],
  fonts: {
    display: { family: "Cinzel", source: "google", licenceConfirmed: false },
    base: { family: "Satoshi", source: "upload", licenceConfirmed: true },
  },
  motion: "thread",
  neverDo: ["no pure black grounds", "no glitter or bokeh sparkle", "no text inside generated images", "no stock-cosmos cliches"],
  personas: [],
} satisfies Omit<BrandKit, "version" | "colours">;

export const journeysWithTime: BrandKit = {
  ...shared,
  version: 1,
  colours: { ground: "#1A1030", accent: "#A8842E", ink: "#FAF6EC", extra: ["#2D1B4E", "#C9A94F"] },
};

export const humanTimeWithGG: BrandKit = {
  ...shared,
  version: 1,
  colours: { ground: "#2A1D16", accent: "#CD9936", ink: "#F2E6C8", extra: [] },
};
