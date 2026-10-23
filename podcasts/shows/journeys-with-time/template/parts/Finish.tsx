// The film finish on every frame: a fine moving grain and a soft vignette. No glow, no light leaks.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { W, H } from "../brand";

export const Finish: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 70% at 50% 42%, transparent 50%, rgba(10,5,20,0.6) 100%)" }} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.08, mixBlendMode: "overlay" }}>
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={f % 12} stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};
