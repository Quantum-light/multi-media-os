import React from "react";
import { Composition } from "remotion";
import { JWTClip } from "./JWTClip";
import { FPS, W, H, INTRO, OUTRO, type ClipProps } from "./brand";

const sample: ClipProps = {
  title: "Starlight Is a Time Machine",
  n: 1,
  total: 12,
  audio: "",
  durationMs: 6000,
  loop: null,
  words: "The light you see tonight left those stars long before you were born."
    .split(" ")
    .map((text, i) => ({ text, start: i * 420, end: i * 420 + 380 })),
};

export const Root: React.FC = () => (
  <Composition
    id="JWTClip"
    component={JWTClip as unknown as React.FC<Record<string, unknown>>}
    fps={FPS}
    width={W}
    height={H}
    durationInFrames={INTRO + Math.ceil((sample.durationMs / 1000) * FPS) + OUTRO}
    defaultProps={sample as unknown as Record<string, unknown>}
    calculateMetadata={({ props }) => ({
      durationInFrames: INTRO + Math.ceil(((props as unknown as ClipProps).durationMs / 1000) * FPS) + OUTRO,
    })}
  />
);
