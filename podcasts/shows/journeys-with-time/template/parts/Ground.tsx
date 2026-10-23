// Night purple ground, a soft orchid bloom and a slow-twinkling field of stars.
import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { C, W, H } from "../brand";

const STARS = Array.from({ length: 90 }, (_, i) => ({
  x: random(`x${i}`) * W,
  y: random(`y${i}`) * H,
  r: 0.8 + random(`r${i}`) * 1.8,
  a: 0.25 + random(`a${i}`) * 0.6,
  p: random(`p${i}`) * Math.PI * 2,
}));

export const Ground: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: C.night }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 34%, rgba(142,92,214,0.32), rgba(142,92,214,0.08) 30%, transparent 56%),
            radial-gradient(ellipse 120% 40% at 50% 105%, rgba(64,32,94,0.55), transparent 70%)`,
        }}
      />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF"
            opacity={s.a * (0.65 + 0.35 * Math.sin(f / 40 + s.p))} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};
