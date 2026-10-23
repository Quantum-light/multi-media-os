// Plays the clip's shot list: each scene enters (0.8 s), holds, then crossfades (0.4 s) into the next.
import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FPS, crimson } from "../brand";
import { SCENES } from "../scenes";

export type Shot = { from: number; scene: string; label?: string; art?: string }; // from = frame; art = plate file
const XF = 12;

export const Stage: React.FC<{ shots: Shot[]; cx: number; cy: number; fade: number; overArt?: boolean }> = ({ shots, cx, cy, fade, overArt }) => {
  const f = useCurrentFrame();
  let i = 0;
  shots.forEach((s, k) => { if (s.from <= f) i = k; });
  const layers = [i - 1, i].filter((k) => k >= 0).map((k) => {
    const s = shots[k];
    const Scene = SCENES[s.scene] || SCENES.sphere;
    const local = f - s.from;
    const opacity = k === i ? 1 : Math.max(0, 1 - (f - shots[i].from) / XF);
    if (opacity <= 0) return null;
    return (
      <g key={k} opacity={opacity}>
        <Scene t={local / FPS} p={local / (FPS * 0.8)} label={s.label} />
      </g>
    );
  });
  const cur = shots[i];
  return (
    <svg width={1000} height={1000} viewBox="-500 -500 1000 1000"
      style={{ position: "absolute", left: cx - 500, top: cy - 500, overflow: "visible", opacity: (1 - fade * 0.65) * (overArt ? 0.7 : 1), transform: `scale(${1 + fade * 0.12})` }}>
      <defs>
        {overArt ? (
          // Over art the line work is a fine engraving: every soft bloom shape is switched off.
          <filter id="bloom"><feComponentTransfer><feFuncA type="linear" slope={0} /></feComponentTransfer></filter>
        ) : (
          <filter id="bloom" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="22" /></filter>
        )}
      </defs>
      {overArt ? (
        // Over art the line work turns burnished gold: white lines map to gold, gold accents stay gold.
        <filter id="goldline"><feColorMatrix type="matrix" values="0.85 0 0 0 0  0.66 0 0 0 0  0.31 0 0 0 0  0 0 0 1 0" /></filter>
      ) : null}
      <g filter={overArt ? "url(#goldline)" : undefined}>{layers}</g>
      {cur && cur.label && cur.scene !== "keyword" ? (
        <text x={-440} y={-370} fill={C.soft} fontFamily={crimson} fontStyle="italic" fontSize={30}
          opacity={Math.min(1, (f - cur.from) / 15) * (1 - fade)}>fig. {i + 1} — {cur.label}</text>
      ) : null}
    </svg>
  );
};
