// Light Field: a slowly turning sphere drawn from points of platinum light.
// Stands in for a Higgsfield loop until the loop library exists.
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, FPS } from "../brand";

const R = 300;
const DOTS = { stroke: C.platinum, strokeLinecap: "round" as const, fill: "none" };

export const LightSphere: React.FC<{ cx: number; cy: number; appear: number; fade: number; expand: number }> = ({ cx, cy, appear, fade, expand }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const spin = t * 0.18; // radians per second: slower than a breath
  const breathe = 1 + 0.015 * Math.sin(t * 1.1);
  const scale = interpolate(appear, [0, 1], [0.88, 1]) * breathe * (1 + expand * 0.3);
  const opacity = appear * (1 - fade * 0.65);
  const meridians = Array.from({ length: 6 }, (_, k) => R * Math.abs(Math.cos((k * Math.PI) / 6 + spin)));
  const lats = [-60, -30, 0, 30, 60].map((d) => (d * Math.PI) / 180);
  const dash = `0.1 ${18 + expand * 40}`;
  return (
    <svg width={1000} height={1000} viewBox="-500 -500 1000 1000"
      style={{ position: "absolute", left: cx - 500, top: cy - 500, opacity, transform: `scale(${scale})` }}>
      <defs>
        <filter id="bloom" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="22" /></filter>
      </defs>
      <circle r={150} fill={C.orchid} opacity={0.32} filter="url(#bloom)" />
      <circle r={34} fill="#FFFFFF" opacity={0.9} filter="url(#bloom)" />
      <circle r={9} fill="#FFFFFF" />
      <circle r={R} {...DOTS} strokeWidth={4.6} strokeDasharray={dash} opacity={0.9} />
      {meridians.map((rx, k) => (
        <ellipse key={`m${k}`} rx={Math.max(rx, 2)} ry={R} {...DOTS} strokeWidth={4} strokeDasharray={dash} opacity={0.35 + 0.45 * (rx / R)} />
      ))}
      {lats.map((a, k) => (
        <ellipse key={`l${k}`} cy={-R * Math.sin(a)} rx={R * Math.cos(a)} ry={R * Math.cos(a) * 0.2}
          {...DOTS} strokeWidth={3.6} strokeDasharray={dash} opacity={0.55} />
      ))}
      <g transform={`rotate(${-18 + t * 1.5})`}>
        <ellipse rx={440} ry={120} fill="none" stroke={C.platinum} strokeWidth={1.4} opacity={0.32} />
        <circle cx={440 * Math.cos(t * 0.5)} cy={120 * Math.sin(t * 0.5)} r={7} fill={C.gold} />
      </g>
      <ellipse rx={420} ry={84} transform={`rotate(${24 - t})`} fill="none" stroke={C.platinum} strokeWidth={1.2} opacity={0.22} />
    </svg>
  );
};
