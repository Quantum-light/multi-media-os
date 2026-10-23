// Scenes about time: the light cone, turning time rings, an hourglass of falling light.
import React from "react";
import { C, crimson } from "../brand";
import { type SceneProps, dotted, line, drawOn, ease } from "./kit";

const label = (x: number, y: number, s: string, color: string = C.soft) => (
  <text x={x} y={y} fill={color} fontFamily={crimson} fontStyle="italic" fontSize={34}>{s}</text>
);

export const Cone: React.FC<SceneProps> = ({ t, p }) => {
  const d = ease(p * 1.2);
  const rings = [80, 160, 240, 320];
  return (
    <g>
      <path pathLength={1} d="M -280 -340 L 280 340" {...line(0.7)} {...drawOn(d)} />
      <path pathLength={1} d="M 280 -340 L -280 340" {...line(0.7)} {...drawOn(d)} />
      {rings.map((y, i) => (
        <g key={y} opacity={ease(p * 2 - i * 0.2)}>
          <ellipse cy={-y} rx={y * 0.82} ry={y * 0.14} {...line(0.35 + i * 0.15)} />
          <ellipse cy={y} rx={y * 0.82} ry={y * 0.14} {...line(0.35 + i * 0.15)} />
        </g>
      ))}
      <line x1={0} y1={-380} x2={0} y2={380} {...line(0.35)} strokeDasharray="4 12" />
      <circle r={10 + 3 * Math.sin(t * 2)} fill={C.gold} />
      <circle r={30 + 8 * Math.sin(t * 2)} fill="none" stroke={C.gold} strokeWidth={2} opacity={0.6} />
      <g opacity={ease(p * 1.5 - 0.5)}>
        {label(60, -330, "future")}{label(60, 360, "past")}{label(44, 12, "now", C.gold)}
      </g>
    </g>
  );
};

export const TimeRings: React.FC<SceneProps> = ({ t, p }) => {
  const radii = [120, 200, 280, 360];
  return (
    <g opacity={ease(p * 1.4)}>
      {radii.map((r, i) => (
        <circle key={r} r={r} {...dotted(14 + i * 4, 4)} opacity={0.4 + i * 0.12}
          transform={`rotate(${(i % 2 ? -1 : 1) * t * (8 - i * 1.5)})`} />
      ))}
      {Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * Math.PI * 2;
        const r1 = i % 5 ? 392 : 380;
        return <line key={i} x1={Math.cos(a) * r1} y1={Math.sin(a) * r1} x2={Math.cos(a) * 404} y2={Math.sin(a) * 404} {...line(0.55, 2)} />;
      })}
      <line x1={0} y1={0} x2={0} y2={-330} {...line(0.8, 2)} transform={`rotate(${t * 12})`} />
      <circle r={10} fill={C.gold} />
      <circle cx={0} cy={-280} r={8} fill={C.gold} transform={`rotate(${-t * 20})`} />
    </g>
  );
};

export const Hourglass: React.FC<SceneProps> = ({ t, p }) => {
  const grains = Array.from({ length: 40 }, (_, i) => ((t * 0.35 + i / 40) % 1));
  return (
    <g opacity={ease(p * 1.4)}>
      <path pathLength={1} d="M -220 -360 L 220 -360 L 18 0 L 220 360 L -220 360 L -18 0 Z" {...line(0.75, 2)} {...drawOn(ease(p * 1.3))} />
      <ellipse cy={-360} rx={220} ry={30} {...line(0.5)} />
      <ellipse cy={360} rx={220} ry={30} {...line(0.5)} />
      {grains.map((g, i) => (
        <circle key={i} cx={Math.sin(i * 7.3) * 6 * (1 - g)} cy={g * 330} r={3} fill={i % 9 ? C.platinum : C.gold} opacity={1 - g * 0.6} />
      ))}
      <path d={`M -150 ${330 - 40 - t * 2} Q 0 ${300 - 60 - t * 3} 150 ${330 - 40 - t * 2} L 200 345 L -200 345 Z`} fill={C.platinum} opacity={0.18} />
    </g>
  );
};
