/**
 * Shared motion tokens. Every block in every brand moves with the same timing,
 * so a change here changes the feel of everything at once.
 */
export const motion = {
  easing: {
    settle: "cubic-bezier(0.22, 1, 0.36, 1)",
    draw: "cubic-bezier(0.65, 0, 0.35, 1)",
  },
  durationsMs: {
    threadDraw: 900,
    captionWord: 140,
    lowerThirdIn: 600,
    lowerThirdHold: 4000,
    chapterKnot: 700,
    imageBeatPush: 6000,
  },
} as const;

/** The thread: QLS's motion signature, one gold line that connects every graphic. */
export const thread = {
  strokePx: 2,
  usage: ["intro underline", "lower-third carry-in", "caption underline", "chapter knots", "image beat frame", "end-card tie-off"],
} as const;
