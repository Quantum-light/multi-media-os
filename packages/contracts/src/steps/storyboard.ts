import { z } from "zod";
import { defineStep } from "../pipeline";
import { ClipOutput } from "./clip";

/** The graphics blocks M7 renders (HyperFrames). Storyboard only plans where they go. */
export const BlockName = z.enum(["lower_third", "chapter_card", "quote_card", "end_card"]);

/** One planned graphic, on the edited timeline. */
export const Cue = z.object({
  atS: z.number().min(0),
  durationS: z.number().positive().max(30),
  block: BlockName,
  text: z.string().min(1).max(200),
});
export type Cue = z.infer<typeof Cue>;

export const StoryboardInput = ClipOutput;
export const StoryboardOutput = z.object({ cues: z.array(Cue), editedDurationS: z.number().positive() });
export type StoryboardOutput = z.infer<typeof StoryboardOutput>;

/** Plans the brand graphics for the master. Video shows only. See specs/steps/storyboard.md. */
export const storyboard = defineStep({ name: "storyboard", input: StoryboardInput, output: StoryboardOutput });
