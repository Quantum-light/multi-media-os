/**
 * Studio's own look: platinum-silver glass, Instrument Serif titles,
 * Satoshi everywhere else, metallic gold for actions, never black.
 * A brand's own fonts and colours appear only inside its previews and outputs.
 */
export const studio = {
  fonts: {
    title: "'Instrument Serif', Georgia, serif",
    body: "'Satoshi', system-ui, sans-serif",
    figures: "'JetBrains Mono', ui-monospace, monospace",
  },
  colour: {
    ink: "#2E3442",
    inkSoft: "#5B616D",
    inkQuiet: "#6A707C",
    gold: "#C9A24A",
    goldLight: "#E6C978",
    goldInk: "#A88A3E",
    hairline: "rgba(46, 52, 66, 0.07)",
    goldHairline: "rgba(201, 162, 74, 0.45)",
    good: "#3E8E64",
    watch: "#8A5A00",
    critical: "#B42318",
  },
  ground: {
    top: "#F1F2F4",
    bottom: "#E3E6EB",
  },
  glass: {
    fill: "rgba(255, 255, 255, 0.42)",
    edge: "rgba(255, 255, 255, 0.75)",
    blur: 30,
    radius: 30,
  },
  goldGradient: "linear-gradient(180deg, #E6C978 0%, #C9A24A 100%)",
} as const;

export type StudioTokens = typeof studio;
